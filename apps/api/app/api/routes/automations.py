from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
from app.core.deps import get_current_user
from app.core.deps import get_db
from app.models.automation import Automation, AutomationLog

router = APIRouter(prefix="/automations", tags=["automations"])


class AutomationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str
    trigger_config: dict = {}
    conditions: Optional[dict] = {}
    action_type: str
    action_config: dict = {}
    journey_phase: Optional[str] = None
    is_active: bool = True


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[dict] = None
    conditions: Optional[dict] = None
    action_type: Optional[str] = None
    action_config: Optional[dict] = None
    journey_phase: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
def list_automations(
    phase: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Automation).order_by(desc(Automation.created_at))
    if phase:
        query = query.filter(Automation.journey_phase == phase)
    return query.all()


@router.post("")
def create_automation(
    data: AutomationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    automation = Automation(
        name=data.name,
        description=data.description,
        trigger_type=data.trigger_type,
        trigger_config=data.trigger_config,
        conditions=data.conditions or {},
        action_type=data.action_type,
        action_config=data.action_config,
        journey_phase=data.journey_phase,
        is_active=data.is_active,
        created_by=current_user.id,
    )
    db.add(automation)
    db.commit()
    db.refresh(automation)
    return automation


@router.get("/{automation_id}")
def get_automation(
    automation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    return automation


@router.put("/{automation_id}")
def update_automation(
    automation_id: int,
    data: AutomationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")

    for field, value in data.dict(exclude_unset=True).items():
        setattr(automation, field, value)

    db.commit()
    db.refresh(automation)
    return automation


@router.patch("/{automation_id}/toggle")
def toggle_automation(
    automation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")

    automation.is_active = not automation.is_active
    db.commit()
    db.refresh(automation)
    return automation


@router.delete("/{automation_id}")
def delete_automation(
    automation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")

    db.delete(automation)
    db.commit()
    return {"detail": "Automação removida"}


@router.get("/{automation_id}/logs")
def get_automation_logs(
    automation_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logs = (
        db.query(AutomationLog)
        .filter(AutomationLog.automation_id == automation_id)
        .order_by(desc(AutomationLog.executed_at))
        .limit(limit)
        .all()
    )
    return logs


@router.get("/logs/recent")
def get_recent_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logs = (
        db.query(AutomationLog)
        .order_by(desc(AutomationLog.executed_at))
        .limit(limit)
        .all()
    )
    return logs
