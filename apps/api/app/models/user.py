import enum
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from app.db.base import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    GESTOR = "gestor"
    ATENDENTE = "atendente"
    VISUALIZADOR = "visualizador"


# Permissões por role e módulo
ROLE_PERMISSIONS = {
    UserRole.ADMIN: {
        "dashboard": ["read"],
        "students": ["read", "create", "update", "delete"],
        "tickets": ["read", "create", "update", "delete"],
        "conversations": ["read", "create", "update"],
        "broadcasts": ["read", "create", "update", "delete"],
        "automations": ["read", "create", "update", "delete"],
        "reports": ["read", "export"],
        "financial": ["read", "update", "sync"],
        "users": ["read", "create", "update", "delete"],
    },
    UserRole.GESTOR: {
        "dashboard": ["read"],
        "students": ["read", "create", "update", "delete"],
        "tickets": ["read", "create", "update", "delete"],
        "conversations": ["read", "create", "update"],
        "broadcasts": ["read", "create", "update", "delete"],
        "automations": ["read"],
        "reports": ["read", "export"],
        "financial": ["read", "update", "sync"],
        "users": [],
    },
    UserRole.ATENDENTE: {
        "dashboard": ["read"],
        "students": ["read"],
        "tickets": ["read", "create", "update"],
        "conversations": ["read", "create", "update"],
        "broadcasts": [],
        "automations": [],
        "reports": [],
        "financial": ["read"],
        "users": [],
    },
    UserRole.VISUALIZADOR: {
        "dashboard": ["read"],
        "students": ["read"],
        "tickets": ["read"],
        "conversations": ["read"],
        "broadcasts": [],
        "automations": [],
        "reports": ["read"],
        "financial": ["read"],
        "users": [],
    },
}


def has_permission(role: UserRole, module: str, action: str) -> bool:
    """Verifica se o role tem permissão para a ação no módulo"""
    perms = ROLE_PERMISSIONS.get(role, {})
    return action in perms.get(module, [])


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.ATENDENTE)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)