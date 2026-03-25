import asyncio
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.broadcast import Broadcast, BroadcastLog
from app.models.student import Student
from app.integrations.whatsapp_meta import send_template, format_phone


def build_template_components(template_params: list, student: Student) -> list:
    """Monta os components do template substituindo variáveis do aluno"""
    if not template_params:
        return []

    # Mapa de variáveis disponíveis
    variables = {
        "{{nome}}": student.name or "",
        "{{primeiro_nome}}": (student.name or "").split()[0] if student.name else "",
        "{{email}}": student.email or "",
        "{{telefone}}": student.phone or "",
        "{{curso}}": student.primary_course_name or "sua pós-graduação no CENAT",
        "{{status_financeiro}}": student.financial_status or "",
    }

    parameters = []
    for param in template_params:
        value = param
        # Substitui variáveis
        for var_key, var_value in variables.items():
            if var_key in str(value):
                value = str(value).replace(var_key, var_value)
        parameters.append({"type": "text", "text": str(value)})

    if not parameters:
        return []

    return [{"type": "body", "parameters": parameters}]


async def execute_broadcast(broadcast_id: int, db_factory):
    """Executa o disparo em massa com rate limiting"""
    db: Session = db_factory()

    try:
        broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
        if not broadcast:
            print(f"❌ Broadcast {broadcast_id} não encontrado")
            return
        if broadcast.status != "draft":
            print(f"⚠️ Broadcast {broadcast_id} não está em rascunho (status: {broadcast.status})")
            return

        # Atualiza status para enviando
        broadcast.status = "sending"
        broadcast.started_at = datetime.utcnow()
        db.commit()

        # Busca alunos com os filtros
        from app.api.routes.broadcasts import apply_student_filters
        q = apply_student_filters(db.query(Student), broadcast.filters or {})
        students = q.all()

        broadcast.total_students = len(students)
        broadcast.pending_count = len(students)
        broadcast.sent_count = 0
        broadcast.failed_count = 0
        db.commit()

        # Cria logs pendentes
        for student in students:
            log = BroadcastLog(
                broadcast_id=broadcast.id,
                student_id=student.id,
                student_name=student.name,
                phone=student.phone,
                status="pending",
            )
            db.add(log)
        db.commit()

        # Envia um por um com rate limiting (1 msg/segundo)
        logs = db.query(BroadcastLog).filter(
            BroadcastLog.broadcast_id == broadcast.id,
            BroadcastLog.status == "pending",
        ).all()

        # Mapeia canal do broadcast para slug do WhatsApp
        channel_map = {
            "cs": "cs",
            "secretaria": "atendimento",
            "financeiro": "financeiro",
            "pedagogico": "pedagogico",
        }
        channel_slug = channel_map.get(broadcast.channel, "cs")

        for log in logs:
            try:
                # Busca aluno para montar params personalizados
                student = db.query(Student).filter(Student.id == log.student_id).first()
                if not student:
                    log.status = "failed"
                    log.error = "Aluno não encontrado"
                    broadcast.failed_count += 1
                    broadcast.pending_count -= 1
                    db.commit()
                    continue

                phone = format_phone(log.phone)
                components = build_template_components(
                    broadcast.template_params or [], student
                )

                result = await send_template(
                    phone=phone,
                    template_name=broadcast.template_name,
                    language=broadcast.template_language or "pt_BR",
                    components=components if components else None,
                    channel_slug=channel_slug,
                )

                if result["status"] == "sent":
                    log.status = "sent"
                    log.message_id = result.get("message_id")
                    log.sent_at = datetime.utcnow()
                    broadcast.sent_count += 1
                else:
                    log.status = "failed"
                    log.error = result.get("error", "Erro desconhecido")
                    broadcast.failed_count += 1

                broadcast.pending_count -= 1
                db.commit()

                # Rate limiting: 1 mensagem por segundo
                await asyncio.sleep(1)

            except Exception as e:
                log.status = "failed"
                log.error = str(e)[:500]
                broadcast.failed_count += 1
                broadcast.pending_count -= 1
                db.commit()
                await asyncio.sleep(1)

        # Finaliza
        if broadcast.failed_count == 0:
            broadcast.status = "completed"
        elif broadcast.sent_count == 0:
            broadcast.status = "failed"
        else:
            broadcast.status = "partial"

        broadcast.completed_at = datetime.utcnow()
        db.commit()

        print(f"✅ Broadcast '{broadcast.name}' finalizado: {broadcast.sent_count} enviados, {broadcast.failed_count} falharam")

    except Exception as e:
        print(f"❌ Erro fatal no broadcast {broadcast_id}: {e}")
        try:
            broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
            if broadcast:
                broadcast.status = "failed"
                broadcast.completed_at = datetime.utcnow()
                db.commit()
        except:
            pass
    finally:
        db.close()
