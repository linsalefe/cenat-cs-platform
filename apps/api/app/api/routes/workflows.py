from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any

from app.core.deps import get_current_user, get_db
from app.db.session import SessionLocal
from app.models.workflow import Workflow
from app.models.workflow_run import WorkflowRun
from app.models.workflow_dispatch_batch import WorkflowDispatchBatch
from app.models.student import Student
from app.services import workflow_engine, workflow_dispatcher
from app.api.routes.broadcasts import _parse_csv_bytes


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


class TriggerPayload(BaseModel):
    student_id: int
    trigger_node_id: Optional[str] = None


# ============================================================
# CRUD (do A.1 — sem mudanças)
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


# ============================================================
# B.1 — Execution endpoints
# ============================================================

@router.post("/{workflow_id}/trigger")
def trigger_workflow(
    workflow_id: int,
    payload: TriggerPayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Dispara um workflow manualmente para um aluno específico.

    - student_id: aluno alvo da execução
    - trigger_node_id (opcional): id de um trigger específico. Se omitido,
      usa o primeiro trigger encontrado no grafo.

    Retorna o WorkflowRun completo (com executed_nodes e result).
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow não encontrado")

    student = (
        db.query(Student).filter(Student.id == payload.student_id).first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    run = workflow_engine.execute_workflow(
        db=db,
        workflow=workflow,
        student=student,
        trigger_node_id=payload.trigger_node_id,
        triggered_by="manual",
        triggered_by_user=current_user.id,
    )

    return {
        "id": run.id,
        "workflow_id": run.workflow_id,
        "student_id": run.student_id,
        "status": run.status,
        "trigger_node_id": run.trigger_node_id,
        "triggered_by": run.triggered_by,
        "triggered_by_user": run.triggered_by_user,
        "current_node_id": run.current_node_id,
        "executed_nodes": run.executed_nodes,
        "result": run.result,
        "error_message": run.error_message,
        "resume_at": run.resume_at,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
    }


# ============================================================
# F3.E — Dispatch CSV (batch + polling)
# ============================================================


def _process_batch_with_own_session(batch_id: int, csv_recipients: list[dict]) -> None:
    """Wrapper chamado pelo BackgroundTasks que cria sua própria session.

    BackgroundTasks executa após o response — a session original do request
    já está fechada. Precisamos abrir uma nova.
    """
    db = SessionLocal()
    try:
        workflow_dispatcher._run_csv_batch(db, batch_id, csv_recipients)
    finally:
        db.close()


@router.post("/{workflow_id}/dispatch-csv")
async def dispatch_workflow_csv(
    workflow_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Dispara o workflow pra uma lista de alunos via CSV (multipart).

    Cria um WorkflowDispatchBatch em background. Resposta retorna imediatamente
    com o batch_id pra polling de progresso via GET /workflows/dispatch-batches/{id}.

    CSV: mesmo formato do /broadcasts/upload-csv — coluna `numero/telefone/phone`
    obrigatória, outras colunas são livres mas IGNORADAS (variáveis vêm do Student).
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(404, "Workflow não encontrado")
    if workflow.status != "active":
        raise HTTPException(
            400,
            f"Workflow precisa estar ativo pra disparar. Status atual: '{workflow.status}'."
        )

    fname = (file.filename or "").lower()
    if not (fname.endswith(".csv") or fname.endswith(".txt")):
        raise HTTPException(400, "Arquivo precisa ter extensão .csv")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Arquivo vazio")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "Arquivo maior que 5 MB")

    try:
        recipients = _parse_csv_bytes(content)
    except ValueError as e:
        raise HTTPException(400, str(e))

    if not recipients:
        raise HTTPException(400, "CSV não tem linhas de dados")

    try:
        batch = workflow_dispatcher.start_csv_dispatch(
            db=db,
            workflow_id=workflow_id,
            csv_recipients=recipients,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    background_tasks.add_task(_process_batch_with_own_session, batch.id, recipients)

    return {
        "batch_id": batch.id,
        "workflow_id": workflow_id,
        "status": batch.status,
        "total_recipients": batch.total_recipients,
        "skipped_no_phone_preflight": batch.skipped_no_phone,
        "message": (
            f"Dispatch iniciado em background pra {batch.total_recipients} destinatário(s). "
            "Acompanhe o progresso em /workflows/dispatch-batches/{batch_id}."
        ),
    }


@router.get("/dispatch-batches/{batch_id}")
def get_dispatch_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retorna estado atual do batch (pra polling do frontend)."""
    batch = (
        db.query(WorkflowDispatchBatch)
        .filter(WorkflowDispatchBatch.id == batch_id)
        .first()
    )
    if not batch:
        raise HTTPException(404, "Batch não encontrado")

    processed = (
        batch.dispatched
        + batch.skipped_active
        + batch.skipped_no_student
        + batch.skipped_no_phone
        + batch.failed
    )
    total = batch.total_recipients or 0
    progress = (processed / total * 100.0) if total > 0 else 0.0

    return {
        "id": batch.id,
        "workflow_id": batch.workflow_id,
        "status": batch.status,
        "total_recipients": batch.total_recipients,
        "dispatched": batch.dispatched,
        "skipped_active": batch.skipped_active,
        "skipped_no_student": batch.skipped_no_student,
        "skipped_no_phone": batch.skipped_no_phone,
        "failed": batch.failed,
        "processed": processed,
        "progress_pct": round(progress, 1),
        "error_message": batch.error_message,
        "created_at": batch.created_at,
        "finished_at": batch.finished_at,
    }


@router.get("/{workflow_id}/runs")
def list_workflow_runs(
    workflow_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lista as execuções mais recentes de um workflow."""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow não encontrado")

    runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id == workflow_id)
        .order_by(desc(WorkflowRun.started_at))
        .limit(limit)
        .all()
    )

    # Serializa com student info inline para economizar requests no front
    out = []
    for run in runs:
        student = None
        if run.student_id:
            s = db.query(Student).filter(Student.id == run.student_id).first()
            if s:
                student = {"id": s.id, "name": s.name}
        out.append(
            {
                "id": run.id,
                "status": run.status,
                "trigger_node_id": run.trigger_node_id,
                "triggered_by": run.triggered_by,
                "student": student,
                "executed_nodes_count": len(run.executed_nodes or []),
                "error_message": run.error_message,
                "started_at": run.started_at,
                "finished_at": run.finished_at,
            }
        )
    return out
