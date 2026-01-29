import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.playbook import Playbook, PlaybookAction, PlaybookExecution, ActionType
from app.models.risk_score import RiskLevel

router = APIRouter(prefix="/playbooks", tags=["playbooks"])


class ActionCreate(BaseModel):
    order: int = 1
    action_type: ActionType
    template: str | None = None
    config: str | None = None
    delay_hours: int = 0


class PlaybookCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_risk_level: RiskLevel
    actions: list[ActionCreate] = []


@router.get("")
def list_playbooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos os playbooks"""
    playbooks = db.query(Playbook).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "trigger_risk_level": p.trigger_risk_level.value,
            "is_active": p.is_active,
            "actions_count": len(p.actions),
        }
        for p in playbooks
    ]


@router.post("")
def create_playbook(
    data: PlaybookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria um novo playbook"""
    playbook = Playbook(
        name=data.name,
        description=data.description,
        trigger_risk_level=data.trigger_risk_level,
    )
    db.add(playbook)
    db.flush()
    
    for action_data in data.actions:
        action = PlaybookAction(
            playbook_id=playbook.id,
            order=action_data.order,
            action_type=action_data.action_type,
            template=action_data.template,
            config=action_data.config,
            delay_hours=action_data.delay_hours,
        )
        db.add(action)
    
    db.commit()
    db.refresh(playbook)
    
    return {
        "id": playbook.id,
        "name": playbook.name,
        "trigger_risk_level": playbook.trigger_risk_level.value,
        "actions_count": len(playbook.actions),
    }


@router.get("/{playbook_id}")
def get_playbook(
    playbook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca playbook por ID"""
    playbook = db.query(Playbook).filter(Playbook.id == playbook_id).first()
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook não encontrado")
    
    return {
        "id": playbook.id,
        "name": playbook.name,
        "description": playbook.description,
        "trigger_risk_level": playbook.trigger_risk_level.value,
        "is_active": playbook.is_active,
        "actions": [
            {
                "id": a.id,
                "order": a.order,
                "action_type": a.action_type.value,
                "template": a.template,
                "delay_hours": a.delay_hours,
            }
            for a in playbook.actions
        ],
    }


@router.post("/{playbook_id}/execute/{student_id}")
async def execute_playbook(
    playbook_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Executa um playbook para um aluno"""
    playbook = db.query(Playbook).filter(Playbook.id == playbook_id).first()
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook não encontrado")
    
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    # Cria registro de execução
    execution = PlaybookExecution(
        playbook_id=playbook_id,
        student_id=student_id,
        status="running",
    )
    db.add(execution)
    db.flush()
    
    results = []
    
    # Executa cada ação
    for action in playbook.actions:
        try:
            if action.action_type == ActionType.WHATSAPP:
                # Envia WhatsApp
                if student.phone:
                    from app.integrations.whatsapp import send_message
                    message = action.template or "Olá! Como podemos ajudar?"
                    message = message.replace("{nome}", student.name)
                    await send_message(student.phone, message)
                    results.append({"action": "whatsapp", "status": "sent"})
                else:
                    results.append({"action": "whatsapp", "status": "skipped", "reason": "no phone"})
            
            elif action.action_type == ActionType.TICKET:
                # Cria ticket
                from app.services import ticket_service
                from app.models.ticket import TicketCategory, TicketPriority
                ticket = ticket_service.create_ticket(
                    db=db,
                    student_id=student_id,
                    category=TicketCategory.ACADEMIC,
                    priority=TicketPriority.HIGH,
                    subject="Acompanhamento - Risco de Evasão",
                    message=action.template or "Aluno identificado em risco de evasão.",
                )
                results.append({"action": "ticket", "status": "created", "ticket_id": ticket.id})
            
            elif action.action_type == ActionType.NOTIFY_TEAM:
                # Notifica equipe (por enquanto só registra)
                results.append({"action": "notify_team", "status": "notified"})
            
            elif action.action_type == ActionType.EMAIL:
                # Email (placeholder)
                results.append({"action": "email", "status": "skipped", "reason": "not implemented"})
        
        except Exception as e:
            results.append({"action": action.action_type.value, "status": "error", "error": str(e)})
    
    # Atualiza execução
    execution.status = "completed"
    execution.result = json.dumps(results)
    from datetime import datetime
    execution.completed_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "execution_id": execution.id,
        "playbook": playbook.name,
        "student": student.name,
        "results": results,
    }


@router.delete("/{playbook_id}")
def delete_playbook(
    playbook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove um playbook"""
    playbook = db.query(Playbook).filter(Playbook.id == playbook_id).first()
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook não encontrado")
    
    # Remove ações
    db.query(PlaybookAction).filter(PlaybookAction.playbook_id == playbook_id).delete()
    db.delete(playbook)
    db.commit()
    
    return {"status": "deleted"}
