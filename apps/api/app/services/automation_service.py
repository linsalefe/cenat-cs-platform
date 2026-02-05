from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.automation import Automation, AutomationLog
from app.models.student import Student
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.moodle_signal import MoodleSignal
from app.models.feedback import Feedback, FeedbackType
from app.models.ticket import TicketCategory, TicketPriority
from app.services import ticket_service


# ========================
# AVALIAÇÃO DE GATILHOS
# ========================

def evaluate_trigger(automation: Automation, student: Student, db: Session) -> bool:
    """Avalia se o aluno atende ao gatilho da automação"""
    trigger_type = automation.trigger_type
    config = automation.trigger_config or {}

    if trigger_type == "days_without_access":
        return _check_days_without_access(student, config, db)

    elif trigger_type == "inactive_student":
        return _check_days_without_access(student, config, db)

    elif trigger_type == "days_after_enrollment":
        return _check_days_after_enrollment(student, config, db)

    elif trigger_type == "nps_response":
        return _check_nps_response(student, config, db)

    elif trigger_type == "first_login":
        return _check_first_login(student, config, db)

    elif trigger_type == "assignment_due_soon":
        # Será implementado com dados de assignments do Moodle
        return False

    elif trigger_type == "module_completed":
        # Será implementado com dados de completion do Moodle
        return False

    return False


def _check_days_without_access(student: Student, config: dict, db: Session) -> bool:
    """Verifica se aluno está sem acessar há X dias"""
    days = config.get("days", 7)

    signal = (
        db.query(MoodleSignal)
        .filter(MoodleSignal.student_id == student.id)
        .order_by(desc(MoodleSignal.captured_at))
        .first()
    )

    if not signal:
        return False

    return signal.days_since_access >= days


def _check_days_after_enrollment(student: Student, config: dict, db: Session) -> bool:
    """Verifica se passaram X dias desde a matrícula"""
    days = config.get("days", 7)

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == student.id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
        .order_by(desc(Enrollment.enrolled_at))
        .first()
    )

    if not enrollment or not enrollment.enrolled_at:
        return False

    days_since = (datetime.utcnow() - enrollment.enrolled_at).days
    return days_since >= days


def _check_nps_response(student: Student, config: dict, db: Session) -> bool:
    """Verifica se o NPS mais recente está dentro do range"""
    nps_min = config.get("nps_min", 0)
    nps_max = config.get("nps_max", 6)

    feedback = (
        db.query(Feedback)
        .filter(
            Feedback.student_id == student.id,
            Feedback.feedback_type == FeedbackType.NPS,
            Feedback.score.isnot(None),
        )
        .order_by(desc(Feedback.created_at))
        .first()
    )

    if not feedback:
        return False

    return nps_min <= feedback.score <= nps_max


def _check_first_login(student: Student, config: dict, db: Session) -> bool:
    """Verifica se o aluno fez o primeiro acesso recentemente (últimas 48h)"""
    hours = config.get("hours_since", 48)

    signals = (
        db.query(MoodleSignal)
        .filter(MoodleSignal.student_id == student.id)
        .order_by(MoodleSignal.captured_at)
        .all()
    )

    # Precisa ter exatamente 1 sinal (primeiro acesso)
    if len(signals) != 1:
        return False

    signal = signals[0]
    if not signal.last_access:
        return False

    hours_since = (datetime.utcnow() - signal.last_access).total_seconds() / 3600
    return hours_since <= hours


# ========================
# EXECUÇÃO DE AÇÕES
# ========================

async def execute_action(automation: Automation, student: Student, db: Session) -> dict:
    """Executa a ação configurada na automação"""
    action_type = automation.action_type
    config = automation.action_config or {}

    # Monta mensagem a partir do template
    template = config.get("template", "")
    message = _replace_variables(template, student, db)

    if action_type == "send_whatsapp":
        return await _action_send_whatsapp(student, message)

    elif action_type == "send_email":
        return {"status": "skipped", "reason": "email não implementado"}

    elif action_type == "create_ticket":
        return _action_create_ticket(student, message, config, db)

    elif action_type == "notify_team":
        return {"status": "skipped", "reason": "notificação não implementada"}

    return {"status": "error", "reason": f"action_type desconhecido: {action_type}"}


def _replace_variables(template: str, student: Student, db: Session) -> str:
    """Substitui variáveis do template com dados do aluno"""
    if not template:
        return ""

    message = template
    message = message.replace("{name}", student.name or "")
    message = message.replace("{email}", student.email or "")
    message = message.replace("{phone}", student.phone or "")

    # Busca dados adicionais
    signal = (
        db.query(MoodleSignal)
        .filter(MoodleSignal.student_id == student.id)
        .order_by(desc(MoodleSignal.captured_at))
        .first()
    )

    if signal:
        message = message.replace("{days}", str(signal.days_since_access))
    else:
        message = message.replace("{days}", "0")

    # Variáveis que serão preenchidas futuramente
    message = message.replace("{course}", "")
    message = message.replace("{assignment}", "")
    message = message.replace("{deadline}", "")

    return message


async def _action_send_whatsapp(student: Student, message: str) -> dict:
    """Envia WhatsApp via Twilio"""
    if not student.phone:
        return {"status": "skipped", "reason": "aluno sem telefone"}

    if not message:
        return {"status": "skipped", "reason": "mensagem vazia"}

    from app.integrations.whatsapp_meta import send_message

    result = await send_message(student.phone, message)
    return {
        "status": "success" if result.get("status") != "error" else "failed",
        "twilio_status": result.get("status"),
        "message_sid": result.get("sid"),
        "phone": student.phone,
    }


def _action_create_ticket(student: Student, message: str, config: dict, db: Session) -> dict:
    """Cria ticket automático"""
    priority_map = {
        "low": TicketPriority.LOW,
        "medium": TicketPriority.MEDIUM,
        "high": TicketPriority.HIGH,
        "urgent": TicketPriority.URGENT,
    }

    priority = priority_map.get(config.get("priority", "medium"), TicketPriority.MEDIUM)

    ticket = ticket_service.create_ticket(
        db=db,
        student_id=student.id,
        category=TicketCategory.ACADEMIC,
        priority=priority,
        subject=config.get("subject", "[Automação] Ação automática"),
        message=message or "Ticket criado automaticamente por automação.",
    )

    return {
        "status": "success",
        "ticket_id": ticket.id,
        "protocol": ticket.protocol,
    }


# ========================
# COOLDOWN
# ========================

def was_already_executed(automation: Automation, student: Student, db: Session) -> bool:
    """Verifica se a automação já foi executada para este aluno (cooldown 24h padrão)"""
    cooldown_hours = (automation.trigger_config or {}).get("cooldown_hours", 24)
    cutoff = datetime.utcnow() - timedelta(hours=cooldown_hours)

    existing = (
        db.query(AutomationLog)
        .filter(
            AutomationLog.automation_id == automation.id,
            AutomationLog.student_id == student.id,
            AutomationLog.status == "success",
            AutomationLog.executed_at >= cutoff,
        )
        .first()
    )

    return existing is not None


# ========================
# MOTOR PRINCIPAL
# ========================

async def run_automation_for_student(automation: Automation, student: Student, db: Session) -> dict | None:
    """Executa uma automação para um aluno se o gatilho for atendido"""

    # Verifica cooldown
    if was_already_executed(automation, student, db):
        return None

    # Avalia gatilho
    if not evaluate_trigger(automation, student, db):
        return None

    # Executa ação
    result = await execute_action(automation, student, db)

    # Registra log
    log = AutomationLog(
        automation_id=automation.id,
        student_id=student.id,
        student_name=student.name,
        action_type=automation.action_type,
        status=result.get("status", "success"),
        details=result,
    )
    db.add(log)
    db.commit()

    return result


async def run_all_automations(db: Session) -> dict:
    """Executa todas as automações ativas para todos os alunos"""

    automations = db.query(Automation).filter(Automation.is_active == True).all()
    students = db.query(Student).all()

    results = {
        "automations_processed": len(automations),
        "students_processed": len(students),
        "actions_executed": 0,
        "actions_skipped": 0,
        "actions_failed": 0,
        "details": [],
    }

    for automation in automations:
        for student in students:
            try:
                result = await run_automation_for_student(automation, student, db)
                if result:
                    if result.get("status") == "success":
                        results["actions_executed"] += 1
                    else:
                        results["actions_failed"] += 1
                    results["details"].append({
                        "automation": automation.name,
                        "student": student.name,
                        **result,
                    })
                else:
                    results["actions_skipped"] += 1
            except Exception as e:
                db.rollback()
                results["actions_failed"] += 1
                results["details"].append({
                    "automation": automation.name,
                    "student": student.name,
                    "status": "error",
                    "error": str(e),
                })

    return results