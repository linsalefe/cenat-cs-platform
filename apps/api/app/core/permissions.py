from fastapi import Depends, HTTPException, status
from app.core.deps import get_current_user
from app.models.user import User, has_permission


def require_permission(module: str, action: str = "read"):
    """Dependency que verifica permissão do usuário"""
    def checker(current_user: User = Depends(get_current_user)):
        if not has_permission(current_user.role, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sem permissão para {action} em {module}",
            )
        return current_user
    return checker
