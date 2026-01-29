import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.trigger import Trigger, TriggerExecution, TriggerConditionType, TriggerActionType
from app.services import trigger_service

router = APIRouter(prefix="/triggers", tags=["triggers"])


class TriggerCreate(BaseModel):
    name: str
    description: str | None = None
    condition_type: TriggerConditionType
    condition_value: str
    action_type: TriggerActionType
    action_template: str | None = None
    cooldown_days: int = 7


class TriggerUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    condition_type: TriggerConditionType | None = None
    condition_value: str | None = None
    action_type: TriggerActionType | None = None
    action_template: str | None = None
    cooldown_days: int | None = None
    is_active: bool | None = None


@router.get("")
def list_triggers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos os triggers"""
    triggers = db.query(Trigger).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "condition_type": t.condition_type.value,
            "condition_value": t.condition_value,
            "action_type": t.action_type.value,
            "cooldown_days": t.cooldown_days,
            "is_active": t.is_active,
        }
        for t in triggers
    ]


@router.post("")
def create_trigger(
    data: TriggerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria um novo trigger"""
    trigger = Trigger(
        name=data.name,
        description=data.description,
        condition_type=data.condition_type,
        condition_value=data.condition_value,
        action_type=data.action_type,
        action_template=data.action_template,
        cooldown_days=data.cooldown_days,
    )
    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    
    return {
        "id": trigger.id,
        "name": trigger.name,
        "condition_type": trigger.condition_type.value,
        "action_type": trigger.action_type.value,
    }


@router.get("/{trigger_id}")
def get_trigger(
    trigger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca trigger por ID"""
    trigger = db.query(Trigger).filter(Trigger.id == trigger_id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger não encontrado")
    
    return {
        "id": trigger.id,
        "name": trigger.name,
        "description": trigger.description,
        "condition_type": trigger.condition_type.value,
        "condition_value": trigger.condition_value,
        "action_type": trigger.action_type.value,
        "action_template": trigger.action_template,
        "cooldown_days": trigger.cooldown_days,
        "is_active": trigger.is_active,
    }


@router.patch("/{trigger_id}")
def update_trigger(
    trigger_id: int,
    data: TriggerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza um trigger"""
    trigger = db.query(Trigger).filter(Trigger.id == trigger_id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger não encontrado")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trigger, field, value)
    
    db.commit()
    db.refresh(trigger)
    
    return {"status": "updated", "id": trigger.id}


@router.delete("/{trigger_id}")
def delete_trigger(
    trigger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove um trigger"""
    trigger = db.query(Trigger).filter(Trigger.id == trigger_id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger não encontrado")
    
    db.delete(trigger)
    db.commit()
    
    return {"status": "deleted"}


@router.post("/run")
async def run_all_triggers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Executa todos os triggers ativos manualmente"""
    results = await trigger_service.run_all_triggers(db)
    return results


@router.get("/{trigger_id}/executions")
def get_trigger_executions(
    trigger_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista execuções de um trigger"""
    executions = db.query(TriggerExecution).filter(
        TriggerExecution.trigger_id == trigger_id
    ).order_by(TriggerExecution.executed_at.desc()).limit(limit).all()
    
    return [
        {
            "id": e.id,
            "student_id": e.student_id,
            "status": e.status,
            "result": json.loads(e.result) if e.result else None,
            "executed_at": e.executed_at.isoformat(),
        }
        for e in executions
    ]
