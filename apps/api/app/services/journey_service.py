from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.journey import JourneyRule, JourneyStep, StudentJourney
from app.models.student import Student
from app.core.whatsapp_channels import get_channel
from app.integrations.whatsapp_meta import send_template
import logging

logger = logging.getLogger(__name__)


def enroll_student(db: Session, journey_rule_id: int, student_id: int):
    """Inscreve um aluno numa régua de jornada"""
    rule = db.query(JourneyRule).filter(JourneyRule.id == journey_rule_id).first()
    if not rule or not rule.is_active:
        return None

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student or not student.phone:
        return None

    # Verifica se já está inscrito (ativo) nesta régua
    existing = db.query(StudentJourney).filter(
        StudentJourney.journey_rule_id == journey_rule_id,
        StudentJourney.student_id == student_id,
        StudentJourney.status.in_(["active", "paused"])
    ).first()
    if existing:
        return existing

    # Busca o primeiro step
    first_step = db.query(JourneyStep).filter(
        JourneyStep.journey_rule_id == journey_rule_id,
        JourneyStep.step_order == 1
    ).first()

    if not first_step:
        return None

    # Calcula quando enviar o primeiro step
    now = datetime.utcnow()
    next_step_at = now + timedelta(days=first_step.delay_days, hours=first_step.delay_hours)

    journey = StudentJourney(
        journey_rule_id=journey_rule_id,
        student_id=student_id,
        student_name=student.name,
        phone=student.phone,
        current_step=0,
        status="active",
        next_step_at=next_step_at,
    )
    db.add(journey)
    db.commit()
    db.refresh(journey)

    logger.info(f"📋 Aluno '{student.name}' inscrito na régua '{rule.name}' — próximo step em {next_step_at}")
    return journey


def enroll_students_by_filter(db: Session, journey_rule_id: int):
    """Inscreve todos os alunos que atendem as condições da régua"""
    rule = db.query(JourneyRule).filter(JourneyRule.id == journey_rule_id).first()
    if not rule:
        return 0

    q = db.query(Student).filter(Student.phone.isnot(None), Student.phone != "")

    # Aplica condições
    conditions = rule.conditions or {}
    if conditions.get("course_id"):
        q = q.filter(Student.primary_course_id == conditions["course_id"])
    if conditions.get("financial_status"):
        q = q.filter(Student.financial_status == conditions["financial_status"])

    students = q.all()
    count = 0
    for student in students:
        result = enroll_student(db, journey_rule_id, student.id)
        if result:
            count += 1

    logger.info(f"📋 {count} alunos inscritos na régua '{rule.name}'")
    return count


def process_pending_steps(db: Session):
    """Processa todos os steps pendentes — chamado pelo scheduler"""
    now = datetime.utcnow()

    # Busca jornadas ativas com next_step_at <= agora
    pending = db.query(StudentJourney).filter(
        StudentJourney.status == "active",
        StudentJourney.next_step_at.isnot(None),
        StudentJourney.next_step_at <= now
    ).all()

    if not pending:
        return 0

    processed = 0
    for sj in pending:
        try:
            _execute_next_step(db, sj)
            processed += 1
        except Exception as e:
            logger.error(f"❌ Erro ao processar jornada {sj.id}: {e}")
            sj.failed_count += 1
            db.commit()

    logger.info(f"⚙️ Scheduler processou {processed} steps pendentes")
    return processed


def _execute_next_step(db: Session, sj: StudentJourney):
    """Executa o próximo step de uma jornada do aluno"""
    next_step_order = sj.current_step + 1

    step = db.query(JourneyStep).filter(
        JourneyStep.journey_rule_id == sj.journey_rule_id,
        JourneyStep.step_order == next_step_order
    ).first()

    if not step:
        # Não tem mais steps — jornada completada
        sj.status = "completed"
        sj.completed_at = datetime.utcnow()
        sj.next_step_at = None
        db.commit()
        logger.info(f"✅ Jornada {sj.id} completada para '{sj.student_name}'")
        return

    rule = db.query(JourneyRule).filter(JourneyRule.id == sj.journey_rule_id).first()
    if not rule:
        return

    # Monta parâmetros personalizados
    student = db.query(Student).filter(Student.id == sj.student_id).first()
    params = _resolve_params(step.template_params or [], student)

    # Envia via Meta API
    channel_config = get_channel(rule.channel)
    try:
        # Envia template com botões se houver
        result = send_template(
            to_phone=sj.phone,
            template_name=step.template_name,
            language=step.template_language,
            params=params,
            phone_number_id=channel_config.phone_number_id,
            token=channel_config.token,
        )

        sj.current_step = next_step_order
        sj.sent_count += 1

        # Calcula próximo step
        next_next = db.query(JourneyStep).filter(
            JourneyStep.journey_rule_id == sj.journey_rule_id,
            JourneyStep.step_order == next_step_order + 1
        ).first()

        if next_next:
            sj.next_step_at = datetime.utcnow() + timedelta(
                days=next_next.delay_days,
                hours=next_next.delay_hours
            )
        else:
            # Último step — completar após envio
            sj.status = "completed"
            sj.completed_at = datetime.utcnow()
            sj.next_step_at = None

        db.commit()
        logger.info(f"📤 Step {next_step_order} enviado para '{sj.student_name}' na régua {sj.journey_rule_id}")

    except Exception as e:
        sj.failed_count += 1
        db.commit()
        logger.error(f"❌ Falha no step {next_step_order} para '{sj.student_name}': {e}")
        raise


def pause_journey(db: Session, student_id: int, journey_rule_id: int = None):
    """Pausa a jornada de um aluno (quando humano assume)"""
    q = db.query(StudentJourney).filter(
        StudentJourney.student_id == student_id,
        StudentJourney.status == "active"
    )
    if journey_rule_id:
        q = q.filter(StudentJourney.journey_rule_id == journey_rule_id)

    journeys = q.all()
    for sj in journeys:
        sj.status = "paused"
        sj.paused_at = datetime.utcnow()
        sj.next_step_at = None

    db.commit()
    return len(journeys)


def stop_journey(db: Session, student_id: int, journey_rule_id: int = None):
    """Para definitivamente a jornada do aluno"""
    q = db.query(StudentJourney).filter(
        StudentJourney.student_id == student_id,
        StudentJourney.status.in_(["active", "paused"])
    )
    if journey_rule_id:
        q = q.filter(StudentJourney.journey_rule_id == journey_rule_id)

    journeys = q.all()
    for sj in journeys:
        sj.status = "stopped"
        sj.completed_at = datetime.utcnow()
        sj.next_step_at = None

    db.commit()
    return len(journeys)


def handle_button_click(db: Session, student_phone: str, button_id: str):
    """Processa clique em botão interativo"""
    # Busca jornada ativa do aluno
    sj = db.query(StudentJourney).filter(
        StudentJourney.phone == student_phone,
        StudentJourney.status == "active"
    ).first()

    if not sj:
        return None

    # Busca o step atual para encontrar o botão
    step = db.query(JourneyStep).filter(
        JourneyStep.journey_rule_id == sj.journey_rule_id,
        JourneyStep.step_order == sj.current_step
    ).first()

    if not step or not step.buttons:
        return None

    # Encontra o botão clicado
    button = None
    for btn in step.buttons:
        if btn.get("id") == button_id:
            button = btn
            break

    if not button:
        return None

    # Registra clique
    sj.last_button_clicked = button_id
    sj.last_button_at = datetime.utcnow()

    # Executa ação do botão
    action = button.get("action", "continue")

    if action == "stop":
        sj.status = "stopped"
        sj.completed_at = datetime.utcnow()
        sj.next_step_at = None
        logger.info(f"🛑 Aluno '{sj.student_name}' clicou '{button.get('text')}' — régua parada")

    elif action == "handoff":
        sj.status = "paused"
        sj.paused_at = datetime.utcnow()
        sj.next_step_at = None
        logger.info(f"🤝 Aluno '{sj.student_name}' clicou '{button.get('text')}' — handoff para humano")

    elif action == "continue":
        logger.info(f"➡️ Aluno '{sj.student_name}' clicou '{button.get('text')}' — régua continua")

    db.commit()
    return {"action": action, "button": button.get("text"), "student": sj.student_name}


def _resolve_params(template_params: list, student) -> list:
    """Substitui variáveis pelos dados reais do aluno"""
    if not student:
        return template_params

    mapping = {
        "{{nome}}": student.name or "",
        "{{primeiro_nome}}": (student.name or "").split()[0] if student.name else "",
        "{{email}}": student.email or "",
        "{{telefone}}": student.phone or "",
        "{{curso}}": student.primary_course_name or "",
        "{{status_financeiro}}": student.financial_status or "",
    }

    resolved = []
    for p in template_params:
        value = mapping.get(p, p)
        resolved.append(value if value else p)

    return resolved