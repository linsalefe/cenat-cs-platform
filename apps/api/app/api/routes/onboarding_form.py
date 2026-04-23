"""
Rotas para configurar o formulário dinâmico de onboarding.

Público:
  GET /onboarding/form-schema — retorna campos ativos (usado pelo /onboarding/form)

Admin/Gestor (require_permission('onboarding_form', 'read'|'create'|'update'|'delete')):
  GET    /onboarding-form/fields           — lista todos (inclusive inativos)
  POST   /onboarding-form/fields           — cria
  PUT    /onboarding-form/fields/{id}      — edita
  PATCH  /onboarding-form/fields/reorder   — reordena (lista de ids)
  DELETE /onboarding-form/fields/{id}      — remove (soft delete: active=false)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
import re

from app.core.deps import get_db
from app.core.permissions import require_permission
from app.models.onboarding_form_field import OnboardingFormField


router = APIRouter(tags=["onboarding-form"])


# ============================================================
# Schemas
# ============================================================

FIELD_TYPES = ("text", "select")


class FieldCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=60)
    label: str = Field(..., min_length=1, max_length=255)
    type: Literal["text", "select"] = "text"
    placeholder: Optional[str] = Field(None, max_length=255)
    required: bool = False
    options: Optional[List[str]] = None

    @field_validator("key")
    @classmethod
    def key_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-z][a-z0-9_]*$", v):
            raise ValueError(
                "key deve começar com letra minúscula e conter apenas "
                "letras minúsculas, números e underscore (ex: cpf, area_atuacao)"
            )
        return v

    @field_validator("options")
    @classmethod
    def options_sanitize(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        cleaned = [o.strip() for o in v if o and o.strip()]
        return cleaned or None


class FieldUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[Literal["text", "select"]] = None
    placeholder: Optional[str] = Field(None, max_length=255)
    required: Optional[bool] = None
    options: Optional[List[str]] = None
    active: Optional[bool] = None


class ReorderPayload(BaseModel):
    field_ids: List[int] = Field(..., min_length=1)


# ============================================================
# Rotas públicas (sem auth)
# ============================================================

# Router separado pro schema público (sem prefixo /onboarding-form)
public_router = APIRouter(tags=["onboarding"])


@public_router.get("/onboarding/form-schema")
def get_form_schema(db: Session = Depends(get_db)):
    """Retorna campos ativos, ordenados. Usado pelo formulário público."""
    fields = (
        db.query(OnboardingFormField)
        .filter(OnboardingFormField.active == True)  # noqa: E712
        .order_by(OnboardingFormField.order_index.asc(), OnboardingFormField.id.asc())
        .all()
    )
    return [
        {
            "id": f.id,
            "key": f.key,
            "label": f.label,
            "type": f.type,
            "placeholder": f.placeholder,
            "required": f.required,
            "options": f.options or [],
        }
        for f in fields
    ]


# ============================================================
# Rotas admin (requer permissão)
# ============================================================

@router.get("/onboarding-form/fields")
def list_fields(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("onboarding_form", "read")),
):
    """Lista TODOS os campos (inclusive inativos) em ordem."""
    fields = (
        db.query(OnboardingFormField)
        .order_by(OnboardingFormField.order_index.asc(), OnboardingFormField.id.asc())
        .all()
    )
    return [
        {
            "id": f.id,
            "key": f.key,
            "label": f.label,
            "type": f.type,
            "placeholder": f.placeholder,
            "required": f.required,
            "options": f.options or [],
            "order_index": f.order_index,
            "active": f.active,
            "created_at": f.created_at,
            "updated_at": f.updated_at,
        }
        for f in fields
    ]


@router.post("/onboarding-form/fields")
def create_field(
    data: FieldCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("onboarding_form", "create")),
):
    # key duplicada?
    existing = (
        db.query(OnboardingFormField)
        .filter(OnboardingFormField.key == data.key)
        .first()
    )
    if existing:
        raise HTTPException(
            409, f"Já existe campo com chave '{data.key}' (id {existing.id})"
        )

    # select precisa de options
    if data.type == "select" and not data.options:
        raise HTTPException(
            400, "Campo do tipo select precisa de pelo menos uma opção"
        )

    # order_index = max + 1
    max_order = (
        db.query(OnboardingFormField)
        .order_by(OnboardingFormField.order_index.desc())
        .first()
    )
    next_order = (max_order.order_index + 1) if max_order else 0

    field = OnboardingFormField(
        key=data.key,
        label=data.label,
        type=data.type,
        placeholder=data.placeholder,
        required=data.required,
        options=data.options or None,
        order_index=next_order,
        active=True,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.put("/onboarding-form/fields/{field_id}")
def update_field(
    field_id: int,
    data: FieldUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("onboarding_form", "update")),
):
    field = (
        db.query(OnboardingFormField)
        .filter(OnboardingFormField.id == field_id)
        .first()
    )
    if not field:
        raise HTTPException(404, "Campo não encontrado")

    payload = data.model_dump(exclude_unset=True)

    # select → options obrigatório
    new_type = payload.get("type", field.type)
    new_options = payload.get("options", field.options) or None
    if new_type == "select" and not new_options:
        raise HTTPException(
            400, "Campo do tipo select precisa de pelo menos uma opção"
        )

    # Sanitiza options
    if "options" in payload and payload["options"] is not None:
        payload["options"] = [
            o.strip() for o in payload["options"] if o and o.strip()
        ] or None

    for k, v in payload.items():
        setattr(field, k, v)

    db.commit()
    db.refresh(field)
    return field


@router.patch("/onboarding-form/fields/reorder")
def reorder_fields(
    data: ReorderPayload,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("onboarding_form", "update")),
):
    """Atualiza order_index na ordem recebida."""
    ids = data.field_ids
    fields = (
        db.query(OnboardingFormField)
        .filter(OnboardingFormField.id.in_(ids))
        .all()
    )
    by_id = {f.id: f for f in fields}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise HTTPException(400, f"IDs inexistentes: {missing}")

    for idx, fid in enumerate(ids):
        by_id[fid].order_index = idx

    db.commit()
    return {"ok": True, "reordered": len(ids)}


@router.delete("/onboarding-form/fields/{field_id}")
def delete_field(
    field_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("onboarding_form", "delete")),
):
    """Soft delete — marca active=False (preserva respostas dos alunos)."""
    field = (
        db.query(OnboardingFormField)
        .filter(OnboardingFormField.id == field_id)
        .first()
    )
    if not field:
        raise HTTPException(404, "Campo não encontrado")

    field.active = False
    db.commit()
    return {"ok": True, "soft_deleted": field_id}
