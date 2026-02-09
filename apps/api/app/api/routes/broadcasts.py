from app.core.permissions import require_permission
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from pydantic import BaseModel

from app.core.deps import get_current_user, get_db
from app.models.broadcast import Broadcast, BroadcastLog
from app.models.student import Student
from app.models.user import User

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])


# ========================
# SCHEMAS
# ========================

class BroadcastCreate(BaseModel):
    name: str
    description: Optional[str] = None
    channel: str = "cs"
    filters: dict = {}
    template_name: str
    template_language: str = "pt_BR"
    template_params: list = []


class BroadcastFilters(BaseModel):
    login_status: Optional[str] = None       # never_logged, logged
    docs_status: Optional[str] = None        # complete, incomplete, none
    financial_status: Optional[str] = None   # em_dia, pendente, inadimplente
    course_id: Optional[int] = None
    search: Optional[str] = None


# ========================
# FILTROS REUTILIZÁVEIS
# ========================

def apply_student_filters(query, filters: dict):
    """Aplica filtros ao query de alunos — mesma lógica da rota /students"""

    login_status = filters.get("login_status")
    if login_status == "never_logged":
        query = query.filter(
            Student.moodle_user_id.isnot(None),
            or_(Student.moodle_first_access.is_(None), Student.moodle_first_access == None)
        )
    elif login_status == "logged":
        query = query.filter(Student.moodle_first_access.isnot(None))

    docs_status = filters.get("docs_status")
    if docs_status == "complete":
        query = query.filter(Student.documents_count >= Student.documents_total)
    elif docs_status == "incomplete":
        query = query.filter(Student.documents_count > 0, Student.documents_count < Student.documents_total)
    elif docs_status == "none":
        query = query.filter(or_(Student.documents_count == 0, Student.documents_count.is_(None)))

    financial_status = filters.get("financial_status")
    if financial_status:
        query = query.filter(Student.financial_status == financial_status)

    course_id = filters.get("course_id")
    if course_id:
        query = query.filter(Student.primary_course_id == course_id)

    search = filters.get("search")
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Student.name.ilike(term), Student.email.ilike(term)))

    # Apenas alunos com telefone (senão não dá pra enviar WhatsApp)
    query = query.filter(Student.phone.isnot(None), Student.phone != "")

    return query


# ========================
# PREVIEW (Item 1.3)
# ========================

@router.get("/preview")
def preview_students(
    login_status: Optional[str] = Query(None),
    docs_status: Optional[str] = Query(None),
    financial_status: Optional[str] = Query(None),
    course_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("broadcasts", "read")),
):
    """Preview dos alunos que serão impactados pelo disparo"""
    filters = {
        "login_status": login_status,
        "docs_status": docs_status,
        "financial_status": financial_status,
        "course_id": course_id,
        "search": search,
    }

    q = apply_student_filters(db.query(Student), filters)
    total = q.count()
    students = q.order_by(Student.name).offset(skip).limit(limit).all()

    return {
        "total": total,
        "showing": len(students),
        "data": [
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "phone": s.phone,
                "primary_course_name": s.primary_course_name,
                "financial_status": s.financial_status,
                "documents_count": s.documents_count or 0,
                "documents_total": s.documents_total or 5,
                "moodle_first_access": s.moodle_first_access.isoformat() if s.moodle_first_access else None,
            }
            for s in students
        ],
    }


# ========================
# CRIAR DISPARO (Item 1.4)
# ========================

@router.post("")
def create_broadcast(
    data: BroadcastCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("broadcasts", "read")),
):
    """Cria um novo disparo em modo rascunho"""
    # Conta quantos alunos serão impactados
    q = apply_student_filters(db.query(Student), data.filters)
    total = q.count()

    broadcast = Broadcast(
        name=data.name,
        description=data.description,
        channel=data.channel,
        filters=data.filters,
        template_name=data.template_name,
        template_language=data.template_language,
        template_params=data.template_params,
        status="draft",
        total_students=total,
        pending_count=total,
        created_by=current_user.id,
    )
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)

    return {
        "id": broadcast.id,
        "name": broadcast.name,
        "status": broadcast.status,
        "total_students": broadcast.total_students,
        "message": f"Disparo criado. {total} alunos serão impactados.",
    }


# ========================
# LISTAR DISPAROS (Item 1.6)
# ========================

@router.get("")
def list_broadcasts(
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("broadcasts", "read")),
):
    """Lista todos os disparos"""
    q = db.query(Broadcast).order_by(desc(Broadcast.created_at))

    if status:
        q = q.filter(Broadcast.status == status)

    total = q.count()
    broadcasts = q.offset(skip).limit(limit).all()

    return {
        "total": total,
        "data": [
            {
                "id": b.id,
                "name": b.name,
                "description": b.description,
                "channel": b.channel,
                "template_name": b.template_name,
                "status": b.status,
                "total_students": b.total_students,
                "sent_count": b.sent_count,
                "failed_count": b.failed_count,
                "pending_count": b.pending_count,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "started_at": b.started_at.isoformat() if b.started_at else None,
                "completed_at": b.completed_at.isoformat() if b.completed_at else None,
            }
            for b in broadcasts
        ],
    }


# ========================
# DETALHE DO DISPARO (Item 1.7)
# ========================

@router.get("/{broadcast_id}")
def get_broadcast(
    broadcast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("broadcasts", "read")),
):
    """Detalhe de um disparo com logs"""
    broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
    if not broadcast:
        raise HTTPException(status_code=404, detail="Disparo não encontrado")

    logs = (
        db.query(BroadcastLog)
        .filter(BroadcastLog.broadcast_id == broadcast_id)
        .order_by(desc(BroadcastLog.created_at))
        .limit(200)
        .all()
    )

    return {
        "id": broadcast.id,
        "name": broadcast.name,
        "description": broadcast.description,
        "channel": broadcast.channel,
        "filters": broadcast.filters,
        "template_name": broadcast.template_name,
        "template_language": broadcast.template_language,
        "template_params": broadcast.template_params,
        "status": broadcast.status,
        "total_students": broadcast.total_students,
        "sent_count": broadcast.sent_count,
        "failed_count": broadcast.failed_count,
        "pending_count": broadcast.pending_count,
        "created_at": broadcast.created_at.isoformat() if broadcast.created_at else None,
        "started_at": broadcast.started_at.isoformat() if broadcast.started_at else None,
        "completed_at": broadcast.completed_at.isoformat() if broadcast.completed_at else None,
        "logs": [
            {
                "id": l.id,
                "student_id": l.student_id,
                "student_name": l.student_name,
                "phone": l.phone,
                "status": l.status,
                "message_id": l.message_id,
                "error": l.error,
                "sent_at": l.sent_at.isoformat() if l.sent_at else None,
            }
            for l in logs
        ],
    }


# ========================
# DELETAR DISPARO
# ========================

@router.delete("/{broadcast_id}")
def delete_broadcast(
    broadcast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("broadcasts", "read")),
):
    """Deleta um disparo (apenas rascunhos)"""
    broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
    if not broadcast:
        raise HTTPException(status_code=404, detail="Disparo não encontrado")

    if broadcast.status != "draft":
        raise HTTPException(status_code=400, detail="Só é possível excluir disparos em rascunho")

    # Remove logs se existirem
    db.query(BroadcastLog).filter(BroadcastLog.broadcast_id == broadcast_id).delete()
    db.delete(broadcast)
    db.commit()

    return {"detail": "Disparo removido"}

# ========================
# DISPARAR (Item 1.5)
# ========================

@router.post("/{broadcast_id}/send")
async def send_broadcast(
    broadcast_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("broadcasts", "read")),
):
    """Inicia o envio do disparo em background"""
    from fastapi import BackgroundTasks as BT
    broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
    if not broadcast:
        raise HTTPException(status_code=404, detail="Disparo não encontrado")

    if broadcast.status != "draft":
        raise HTTPException(status_code=400, detail=f"Disparo já foi processado (status: {broadcast.status})")

    # Executa em background
    from app.services.broadcast_service import execute_broadcast
    from app.db.session import SessionLocal

    background_tasks.add_task(execute_broadcast, broadcast_id, SessionLocal)

    return {
        "message": "Disparo iniciado!",
        "broadcast_id": broadcast.id,
        "total_students": broadcast.total_students,
    }
