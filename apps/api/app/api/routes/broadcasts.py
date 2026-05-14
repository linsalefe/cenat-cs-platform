from app.core.permissions import require_permission
import csv
import io
import re
import unicodedata
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from pydantic import BaseModel

from app.core.deps import get_current_user, get_db
from app.models.broadcast import Broadcast, BroadcastLog
from app.models.student import Student
from app.models.user import User


# ========================
# CSV HELPERS
# ========================

CSV_MAX_ROWS = 5000

PHONE_ALIASES = {"numero", "número", "telefone", "phone", "whatsapp", "celular"}
NAME_ALIASES = {"nome", "name"}


def _normalize_header(h: str) -> str:
    """Normaliza header de CSV: lowercase, sem acentos, espaços -> _"""
    if not h:
        return ""
    h = h.strip().lower()
    # remove acentos
    h = unicodedata.normalize("NFKD", h).encode("ASCII", "ignore").decode("ASCII")
    # espaços e separadores -> _
    h = re.sub(r"[\s\-\.]+", "_", h)
    # remove o que sobrar fora de [a-z0-9_]
    h = re.sub(r"[^a-z0-9_]", "", h)
    return h


def _clean_phone(raw: str) -> str:
    """Remove formatação básica do telefone (mantém só dígitos). Não adiciona 55 — format_phone faz isso."""
    if not raw:
        return ""
    return re.sub(r"\D+", "", str(raw))


def _parse_csv_bytes(content: bytes) -> list[dict]:
    """Parse CSV bytes -> lista de recipients {phone, name, vars}.

    Levanta ValueError em casos terminais (sem header, sem coluna de telefone, > CSV_MAX_ROWS).
    """
    # Decode tolerante a BOM
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError:
            raise ValueError("Encoding do CSV não reconhecido (use UTF-8)")

    # Sniff de delimiter (vírgula ou ponto-e-vírgula)
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;")
    except csv.Error:
        # Fallback: vírgula
        dialect = csv.excel
        dialect.delimiter = ","

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise ValueError("CSV sem cabeçalho")

    # Mapa: header_original -> header_normalizado
    headers_norm = {h: _normalize_header(h) for h in reader.fieldnames}

    # Identifica coluna de telefone
    phone_col = None
    name_col = None
    for orig, norm in headers_norm.items():
        if norm in PHONE_ALIASES and phone_col is None:
            phone_col = orig
        if norm in NAME_ALIASES and name_col is None:
            name_col = orig
    if not phone_col:
        raise ValueError(
            "CSV precisa ter uma coluna de telefone "
            f"(aceita: {', '.join(sorted(PHONE_ALIASES))})"
        )

    recipients = []
    for i, row in enumerate(reader, start=2):  # start=2 pq linha 1 é o header
        if i - 1 > CSV_MAX_ROWS:
            raise ValueError(f"CSV excede o limite de {CSV_MAX_ROWS} linhas")

        phone = _clean_phone(row.get(phone_col, ""))
        name = (row.get(name_col, "") or "").strip() if name_col else ""

        # Constrói vars com todos os campos exceto phone/name
        vars_data = {}
        for orig, norm in headers_norm.items():
            if orig in (phone_col, name_col):
                continue
            if not norm:
                continue
            val = (row.get(orig, "") or "").strip()
            if val:
                vars_data[norm] = val

        recipients.append({
            "phone": phone,
            "name": name,
            "vars": vars_data,
        })

    return recipients

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
# UPLOAD CSV (F3.A.1)
# ========================

@router.post("/upload-csv")
async def upload_csv_broadcast(
    file: UploadFile = File(...),
    name: str = Form(...),
    channel: str = Form("financeiro"),
    template_name: str = Form(...),
    template_language: str = Form("pt_BR"),
    template_params: str = Form("[]"),  # JSON-encoded list
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("broadcasts", "read")),
):
    """Cria um disparo em modo CSV a partir de um arquivo enviado.

    template_params: JSON com a lista de placeholders, ex: '["{{primeiro_nome}}","{{curso}}"]'
    """
    import json

    # Valida content-type (best-effort)
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

    # template_params vem como string JSON
    try:
        params_list = json.loads(template_params) if template_params else []
        if not isinstance(params_list, list):
            raise ValueError("deve ser lista")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(400, f"template_params inválido: {e}")

    valid_count = sum(1 for r in recipients if r.get("phone"))

    broadcast = Broadcast(
        name=name,
        description=description,
        channel=channel,
        source_type="csv",
        csv_recipients=recipients,
        filters={},
        template_name=template_name,
        template_language=template_language,
        template_params=params_list,
        status="draft",
        total_students=len(recipients),
        pending_count=valid_count,
        failed_count=len(recipients) - valid_count,
        created_by=current_user.id,
    )
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)

    return {
        "id": broadcast.id,
        "name": broadcast.name,
        "status": broadcast.status,
        "total_recipients": len(recipients),
        "valid_recipients": valid_count,
        "invalid_recipients": len(recipients) - valid_count,
        "message": (
            f"Disparo CSV criado. {valid_count} destinatários válidos, "
            f"{len(recipients) - valid_count} inválidos (sem telefone)."
        ),
    }


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
