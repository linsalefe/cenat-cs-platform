import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.student import Student
from app.models.moodle_signal import MoodleSignal
from app.models.risk_score import RiskScore, RiskLevel
from app.models.trigger import Trigger, TriggerExecution, TriggerConditionType, TriggerActionType
from app.models.ticket import TicketCategory, TicketPriority
from app.services import ticket_service


def check_condition(trigger: Trigger, student: Student, db: Session) -> bool:
    """Verifica se o aluno atende à condição do trigger"""
    
    # Busca sinais mais recentes do Moodle
    latest_signal = db.query(MoodleSignal).filter(
        MoodleSignal.student_id == student.id
    ).order_by(MoodleSignal.captured_at.desc()).first()
    
    # Busca score de risco
    risk_score = db.query(RiskScore).filter(
        RiskScore.student_id == student.id
    ).first()
    
    condition_value = trigger.condition_value
    
    if trigger.condition_type == TriggerConditionType.DAYS_WITHOUT_ACCESS:
        if not latest_signal:
            return False
        return latest_signal.days_since_access >= int(condition_value)
    
    elif trigger.condition_type == TriggerConditionType.PROGRESS_BELOW:
        if not latest_signal:
            return False
        return latest_signal.progress_percent < float(condition_value)
    
    elif trigger.condition_type == TriggerConditionType.GRADE_BELOW:
        if not latest_signal or latest_signal.course_grade is None:
            return False
        return latest_signal.course_grade < float(condition_value)
    
    elif trigger.condition_type == TriggerConditionType.RISK_LEVEL:
        if not risk_score:
            return False
        # condition_value pode ser: "critical", "high", "medium"
        risk_levels_priority = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        min_level = risk_levels_priority.get(condition_value, 0)
        current_level = risk_levels_priority.get(risk_score.level.value, 0)
        return current_level >= min_level
    
    elif trigger.condition_type == TriggerConditionType.OVERDUE_DAYS:
        # Será implementado com ASAAS
        return False
    
    return False


def was_recently_executed(trigger: Trigger, student: Student, db: Session) -> bool:
    """Verifica se o trigger já foi executado recentemente para este aluno"""
    cutoff = datetime.utcnow() - timedelta(days=trigger.cooldown_days)
    
    recent_execution = db.query(TriggerExecution).filter(
        TriggerExecution.trigger_id == trigger.id,
        TriggerExecution.student_id == student.id,
        TriggerExecution.executed_at >= cutoff
    ).first()
    
    return recent_execution is not None


async def execute_trigger_action(trigger: Trigger, student: Student, db: Session) -> dict:
    """Executa a ação do trigger"""
    result = {"trigger": trigger.name, "student": student.name, "action": trigger.action_type.value}
    
    # Substitui variáveis no template
    message = trigger.action_template or ""
    message = message.replace("{nome}", student.name)
    message = message.replace("{email}", student.email)
    message = message.replace("{phone}", student.phone or "")
    
    try:
        if trigger.action_type == TriggerActionType.SEND_WHATSAPP:
            if student.phone:
                from app.integrations.twilio_service import send_message
                await send_message(student.phone, message)
                result["status"] = "sent"
            else:
                result["status"] = "skipped"
                result["reason"] = "no phone"
        
        elif trigger.action_type == TriggerActionType.SEND_EMAIL:
            # Placeholder para email
            result["status"] = "skipped"
            result["reason"] = "email not implemented"
        
        elif trigger.action_type == TriggerActionType.CREATE_TICKET:
            ticket = ticket_service.create_ticket(
                db=db,
                student_id=student.id,
                category=TicketCategory.ACADEMIC,
                priority=TicketPriority.HIGH,
                subject=f"[Automático] {trigger.name}",
                message=message or f"Trigger automático: {trigger.description}",
            )
            result["status"] = "created"
            result["ticket_id"] = ticket.id
        
        elif trigger.action_type == TriggerActionType.NOTIFY_TEAM:
            # Placeholder para notificação
            result["status"] = "notified"
        
        else:
            result["status"] = "unknown_action"
    
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
    
    return result


async def run_trigger_for_student(trigger: Trigger, student: Student, db: Session) -> dict | None:
    """Executa um trigger para um aluno específico se as condições forem atendidas"""
    
    # Verifica cooldown
    if was_recently_executed(trigger, student, db):
        return None
    
    # Verifica condição
    if not check_condition(trigger, student, db):
        return None
    
    # Executa ação
    result = await execute_trigger_action(trigger, student, db)
    
    # Registra execução
    execution = TriggerExecution(
        trigger_id=trigger.id,
        student_id=student.id,
        status=result.get("status", "executed"),
        result=json.dumps(result, ensure_ascii=False),
    )
    db.add(execution)
    db.commit()
    
    return result


async def run_all_triggers(db: Session) -> dict:
    """Executa todos os triggers ativos para todos os alunos"""
    
    triggers = db.query(Trigger).filter(Trigger.is_active == True).all()
    students = db.query(Student).all()
    
    results = {
        "triggers_processed": len(triggers),
        "students_processed": len(students),
        "actions_executed": 0,
        "actions_skipped": 0,
        "details": []
    }
    
    for trigger in triggers:
        for student in students:
            result = await run_trigger_for_student(trigger, student, db)
            if result:
                results["actions_executed"] += 1
                results["details"].append(result)
            else:
                results["actions_skipped"] += 1
    
    return results
