from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any
from app.core.deps import get_current_user, get_db
from app.models.workflow import Workflow


router = APIRouter(prefix="/workflows", tags=["workflows"])


# ============================================================
# Schemas
# ============================================================

class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[Literal["draft", "active", "paused"]] = None
    nodes: Optional[List[Any]] = None
    edges: Optional[List[Any]] = None


# ============================================================
# Rotas
# ============================================================

@router.get("")
def list_workflows(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lista workflows (payload leve — sem nodes/edges)."""
    query = db.query(Workflow).order_by(desc(Workflow.updated_at))
    if status:
        query = query.filter(Workflow.status == status)

    workflows = query.all()
    return [
        {
            "id": w.id,
            "name": w.name,
            "description": w.description,
            "status": w.status,
            "nodes_count": len(w.nodes or []),
            "edges_count": len(w.edges or []),
            "runs_count": w.runs_count or 0,
            "last_run_at": w.last_run_at,
            "created_at": w.created_at,
            "updated_at": w.updated_at,
        }
        for w in workflows
    ]


@router.post("")
def create_workflow(
    data: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Cria workflow vazio (nodes=[], edges=[], status=draft)."""
    workflow = Workflow(
        name=data.name,
        description=data.description,
        status="draft",
        nodes=[],
        edges=[],
        created_by=current_user.id,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


@router.get("/{workflow_id}")
def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow não encontrado")
    return workflow


@router.put("/{workflow_id}")
def update_workflow(
    workflow_id: int,
    data: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Atualiza nome/descrição/status/grafo."""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow não encontrado")

    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(workflow, field, value)

    db.commit()
    db.refresh(workflow)
    return workflow


@router.patch("/{workflow_id}/toggle")
def toggle_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Alterna active <-> paused. Em draft, passa para active."""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow não encontrado")

    if workflow.status == "active":
        workflow.status = "paused"
    else:
        workflow.status = "active"

    db.commit()
    db.refresh(workflow)
    return workflow


@router.delete("/{workflow_id}")
def delete_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow não encontrado")
    db.delete(workflow)
    db.commit()
    return {"detail": "Workflow removido"}
