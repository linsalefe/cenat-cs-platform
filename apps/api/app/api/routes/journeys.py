from app.core.permissions import require_permission
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel

from app.core.deps import get_current_user, get_db
from app.models.journey import JourneyRule, JourneyStep, StudentJourney
from app.models.user import User

router = APIRouter(prefix="/journeys", tags=["journeys"])


# ========================
# SCHEMAS
# ========================

class StepCreate(BaseModel):
    step_order: int
    delay_days: int = 0
    delay_hours: int = 0
    template_name: str
    template_language: str = "pt_BR"
    template_params: list = []
    buttons: list = []
    title: Optional[str] = None


class JourneyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str = "new_enrollment"
    trigger_config: dict = {}
    channel: str = "cs"
    conditions: dict = {}
    on_reply: str = "pause"
    steps: List[StepCreate] = []


class JourneyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[dict] = None
    channel: Optional[str] = None
    conditions: Optional[dict] = None
    on_reply: Optional[str] = None


class StepUpdate(BaseModel):
    delay_days: Optional[int] = None
    delay_hours: Optional[int] = None
    template_name: Optional[str] = None
    template_language: Optional[str] = None
    template_params: Optional[list] = None
    buttons: Optional[list] = None
    title: Optional[str] = None


# ========================
# LISTAR RÉGUAS
# ========================

@router.get("")
def list_journeys(
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automations", "read")),
):
    q = db.query(JourneyRule).order_by(desc(JourneyRule.created_at))

    if is_active is not None:
        q = q.filter(JourneyRule.is_active == is_active)

    rules = q.all()

    result = []
    for r in rules:
        steps_count = db.query(JourneyStep).filter(JourneyStep.journey_rule_id == r.id).count()
        active_students = db.query(StudentJourney).filter(
            StudentJourney.journey_rule_id == r.id,
            StudentJourney.status == "active"
        ).count()
        total_students = db.query(StudentJourney).filter(
            StudentJourney.journey_rule_id == r.id
        ).count()

        result.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "trigger_type": r.trigger_type,
            "channel": r.channel,
            "on_reply": r.on_reply,
            "is_active": r.is_active,
            "steps_count": steps_count,
            "active_students": active_students,
            "total_students": total_students,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"total": len(result), "data": result}


# ========================
# CRIAR RÉGUA
# ========================

@router.post("")
def create_journey(
    data: JourneyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automations", "read")),
):
    if len(data.steps) > 10:
        raise HTTPException(status_code=400, detail="Máximo de 10 steps por régua")

    rule = JourneyRule(
        name=data.name,
        description=data.description,
        trigger_type=data.trigger_type,
        trigger_config=data.trigger_config,
        channel=data.channel,
        conditions=data.conditions,
        on_reply=data.on_reply,
        max_steps=len(data.steps),
        is_active=False,
        created_by=current_user.id,
    )
    db.add(rule)
    db.flush()

    for s in data.steps:
        if len(s.buttons) > 3:
            raise HTTPException(status_code=400, detail=f"Step {s.step_order}: máximo 3 botões")

        step = JourneyStep(
            journey_rule_id=rule.id,
            step_order=s.step_order,
            delay_days=s.delay_days,
            delay_hours=s.delay_hours,
            template_name=s.template_name,
            template_language=s.template_language,
            template_params=s.template_params,
            buttons=s.buttons,
            title=s.title,
        )
        db.add(step)

    db.commit()
    db.refresh(rule)

    return {
        "id": rule.id,
        "name": rule.name,
        "steps_count": len(data.steps),
        "message": f"Régua '{rule.name}' criada com {len(data.steps)} steps.",
    }


# ========================
# DETALHE DA RÉGUA
# ========================

@router.get("/{journey_id}")
def get_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automations", "read")),
):
    rule = db.query(JourneyRule).filter(JourneyRule.id == journey_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Régua não encontrada")

    steps = (
        db.query(JourneyStep)
        .filter(JourneyStep.journey_rule_id == journey_id)
        .order_by(JourneyStep.step_order)
        .all()
    )

    students = (
        db.query(StudentJourney)
        .filter(StudentJourney.journey_rule_id == journey_id)
        .order_by(desc(StudentJourney.created_at))
        .limit(100)
        .all()
    )

    return {
        "id": rule.id,
        "name": rule.name,
        "description": rule.description,
        "trigger_type": rule.trigger_type,
        "trigger_config": rule.trigger_config,
        "channel": rule.channel,
        "conditions": rule.conditions,
        "on_reply": rule.on_reply,
        "max_steps": rule.max_steps,
        "is_active": rule.is_active,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "steps": [
            {
                "id": s.id,
                "step_order": s.step_order,
                "delay_days": s.delay_days,
                "delay_hours": s.delay_hours,
                "template_name": s.template_name,
                "template_language": s.template_language,
                "template_params": s.template_params,
                "buttons": s.buttons,
                "title": s.title,
                "is_active": s.is_active,
            }
            for s in steps
        ],
        "students": [
            {
                "id": sj.id,
                "student_id": sj.student_id,
                "student_name": sj.student_name,
                "phone": sj.phone,
                "current_step": sj.current_step,
                "status": sj.status,
                "sent_count": sj.sent_count,
                "failed_count": sj.failed_count,
                "last_button_clicked": sj.last_button_clicked,
                "started_at": sj.started_at.isoformat() if sj.started_at else None,
                "next_step_at": sj.next_step_at.isoformat() if sj.next_step_at else None,
                "completed_at": sj.completed_at.isoformat() if sj.completed_at else None,
            }
            for sj in students
        ],
    }


# ========================
# ATIVAR / DESATIVAR
# ========================

@router.post("/{journey_id}/toggle")
def toggle_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automations", "read")),
):
    rule = db.query(JourneyRule).filter(JourneyRule.id == journey_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Régua não encontrada")

    # Validar que tem pelo menos 1 step antes de ativar
    if not rule.is_active:
        steps_count = db.query(JourneyStep).filter(JourneyStep.journey_rule_id == journey_id).count()
        if steps_count == 0:
            raise HTTPException(status_code=400, detail="Adicione pelo menos 1 step antes de ativar")

    rule.is_active = not rule.is_active
    db.commit()

    status = "ativada" if rule.is_active else "desativada"
    return {"message": f"Régua {status}", "is_active": rule.is_active}


# ========================
# DELETAR RÉGUA
# ========================

@router.delete("/{journey_id}")
def delete_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automations", "read")),
):
    rule = db.query(JourneyRule).filter(JourneyRule.id == journey_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Régua não encontrada")

    if rule.is_active:
        raise HTTPException(status_code=400, detail="Desative a régua antes de excluir")

    # Verifica alunos ativos
    active = db.query(StudentJourney).filter(
        StudentJourney.journey_rule_id == journey_id,
        StudentJourney.status == "active"
    ).count()
    if active > 0:
        raise HTTPException(status_code=400, detail=f"Ainda há {active} alunos ativos nesta régua")

    db.query(StudentJourney).filter(StudentJourney.journey_rule_id == journey_id).delete()
    db.query(JourneyStep).filter(JourneyStep.journey_rule_id == journey_id).delete()
    db.delete(rule)
    db.commit()

    return {"detail": "Régua removida"}


# ========================
# ADICIONAR STEP
# ========================

@router.post("/{journey_id}/steps")
def add_step(
    journey_id: int,
    data: StepCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automations", "read")),
):
    rule = db.query(JourneyRule).filter(JourneyRule.id == journey_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Régua não encontrada")

    steps_count = db.query(JourneyStep).filter(JourneyStep.journey_rule_id == journey_id).count()
    if steps_count >= 10:
        raise HTTPException(status_code=400, detail="Máximo de 10 steps atingido")

    if len(data.buttons) > 3:
        raise HTTPException(status_code=400, detail="Máximo 3 botões por step")

    step = JourneyStep(
        journey_rule_id=journey_id,
        step_order=data.step_order,
        delay_days=data.delay_days,
        delay_hours=data.delay_hours,
        template_name=data.template_name,
        template_language=data.template_language,
        template_params=data.template_params,
        buttons=data.buttons,
        title=data.title,
    )
    db.add(step)
    rule.max_steps = steps_count + 1
    db.commit()
    db.refresh(step)

    return {"id": step.id, "step_order": step.step_order, "message": "Step adicionado"}


# ========================
# REMOVER STEP
# ========================

@router.delete("/{journey_id}/steps/{step_id}")
def remove_step(
    journey_id: int,
    step_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automations", "read")),
):
    step = db.query(JourneyStep).filter(
        JourneyStep.id == step_id,
        JourneyStep.journey_rule_id == journey_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step não encontrado")

    db.delete(step)

    rule = db.query(JourneyRule).filter(JourneyRule.id == journey_id).first()
    if rule:
        rule.max_steps = db.query(JourneyStep).filter(JourneyStep.journey_rule_id == journey_id).count()

    db.commit()

    return {"detail": "Step removido"}