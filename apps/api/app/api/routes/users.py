from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from passlib.context import CryptContext

from app.core.deps import get_db
from app.core.permissions import require_permission
from app.models.user import User, UserRole, ROLE_PERMISSIONS

router = APIRouter(prefix="/users", tags=["users"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.ATENDENTE
    channel: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    channel: Optional[str] = None


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users", "read")),
):
    """Lista todos os usuários"""
    users = db.query(User).order_by(User.name).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("")
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users", "create")),
):
    """Cria novo usuário"""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=pwd_context.hash(data.password),
        role=data.role,
        channel=data.channel,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
        
    }


@router.put("/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users", "update")),
):
    """Atualiza usuário"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if user.id == current_user.id and data.role and data.role != user.role:
        raise HTTPException(status_code=400, detail="Você não pode alterar seu próprio role")

    if data.name:
        user.name = data.name
    if data.role:
        user.role = data.role
    if data.is_active is not None:
        if user.id == current_user.id and not data.is_active:
            raise HTTPException(status_code=400, detail="Você não pode desativar a si mesmo")
        user.is_active = data.is_active
    if data.password:
        user.hashed_password = pwd_context.hash(data.password)
    if data.channel is not None:
        user.channel = data.channel

    db.commit()

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users", "delete")),
):
    """Deleta usuário"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode deletar a si mesmo")

    db.delete(user)
    db.commit()

    return {"status": "ok", "deleted": user_id}


@router.get("/permissions")
def get_permissions(
    current_user: User = Depends(require_permission("users", "read")),
):
    """Retorna matriz de permissões por role"""
    return {
        role.value: {
            module: actions
            for module, actions in perms.items()
        }
        for role, perms in ROLE_PERMISSIONS.items()
    }


@router.get("/me/permissions")
def get_my_permissions(
    current_user: User = Depends(require_permission("dashboard", "read")),
):
    """Retorna permissões do usuário logado"""
    perms = ROLE_PERMISSIONS.get(current_user.role, {})
    return {
        "role": current_user.role.value,
        "permissions": perms,
    }