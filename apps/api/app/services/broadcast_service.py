import asyncio
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.broadcast import Broadcast, BroadcastLog
from app.models.student import Student
from app.integrations.whatsapp_meta import send_template, format_phone


def _vars_from_student(student: Student) -> dict:
    """Mapa de variáveis derivado de um Student da base."""
    name = student.name or ""
    return {
        "nome": name,
        "primeiro_nome": name.split()[0] if name else "",
        "email": student.email or "",
        "telefone": student.phone or "",
        "curso": student.primary_course_name or "sua pós-graduação no CENAT",
        "status_financeiro": student.financial_status or "",
    }


def _vars_from_csv_recipient(recipient: dict) -> dict:
    """Mapa de variáveis derivado de um item de csv_recipients."""
    name = (recipient.get("name") or "").strip()
    base = {
        "nome": name,
        "primeiro_nome": name.split()[0] if name else "",
        "telefone": recipient.get("phone") or "",
    }
    # vars custom do CSV (curso, matricula, etc) sobrescrevem se houver conflito
    base.update(recipient.get("vars") or {})
    # Default pra curso ausente (sem essa frase o template fica feio)
    if not base.get("curso"):
        base["curso"] = "sua pós-graduação no CENAT"
    return base


def build_template_components(template_params: list, vars_map: dict) -> list:
    """Monta os components do template substituindo variáveis.

    template_params: lista de placeholders, ex: ["{{primeiro_nome}}", "{{curso}}"]
    vars_map: dict com chaves sem chaves duplas, ex: {"primeiro_nome": "João", ...}
    """
    if not template_params:
        return []

    # Garante prefixo/sufixo de chaves: aceita "{{x}}", "{x}", ou só "x"
    parameters = []
    for param in template_params:
        value = str(param)
        for var_key, var_value in vars_map.items():
            for token in (f"{{{{{var_key}}}}}", f"{{{var_key}}}"):
                if token in value:
                    value = value.replace(token, str(var_value or ""))
        parameters.append({"type": "text", "text": value})

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

        source_type = (broadcast.source_type or "filters").lower()

        if source_type == "csv":
            recipients = broadcast.csv_recipients or []
            total = len(recipients)
            broadcast.total_students = total
            broadcast.pending_count = total
            broadcast.sent_count = 0
            broadcast.failed_count = 0
            db.commit()

            # Cria logs pendentes a partir do CSV (sem FK pra student)
            for r in recipients:
                phone_raw = (r.get("phone") or "").strip()
                name = (r.get("name") or "").strip() or None
                vars_data = r.get("vars") or {}
                if not phone_raw:
                    # Marca falha já no preflight
                    log = BroadcastLog(
                        broadcast_id=broadcast.id,
                        student_id=None,
                        student_name=name,
                        phone=None,
                        extra_data=vars_data,
                        status="failed",
                        error="numero ausente",
                    )
                    db.add(log)
                    broadcast.failed_count += 1
                    broadcast.pending_count -= 1
                    continue
                log = BroadcastLog(
                    broadcast_id=broadcast.id,
                    student_id=None,
                    student_name=name,
                    phone=phone_raw,
                    extra_data=vars_data,
                    status="pending",
                )
                db.add(log)
            db.commit()
        else:
            # source_type == "filters" (default, compat)
            from app.api.routes.broadcasts import apply_student_filters
            q = apply_student_filters(db.query(Student), broadcast.filters or {})
            students = q.all()

            broadcast.total_students = len(students)
            broadcast.pending_count = len(students)
            broadcast.sent_count = 0
            broadcast.failed_count = 0
            db.commit()

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
                # Monta vars conforme origem
                if log.student_id is not None:
                    student = db.query(Student).filter(Student.id == log.student_id).first()
                    if not student:
                        log.status = "failed"
                        log.error = "Aluno não encontrado"
                        broadcast.failed_count += 1
                        broadcast.pending_count -= 1
                        db.commit()
                        continue
                    vars_map = _vars_from_student(student)
                else:
                    # CSV: usa o que veio no log
                    vars_map = _vars_from_csv_recipient({
                        "name": log.student_name,
                        "phone": log.phone,
                        "vars": log.extra_data or {},
                    })

                if not log.phone:
                    log.status = "failed"
                    log.error = "Sem telefone"
                    broadcast.failed_count += 1
                    broadcast.pending_count -= 1
                    db.commit()
                    continue

                phone = format_phone(log.phone)
                components = build_template_components(
                    broadcast.template_params or [], vars_map
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
