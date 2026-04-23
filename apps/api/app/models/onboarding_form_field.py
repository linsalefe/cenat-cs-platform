from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from app.db.base import Base


class OnboardingFormField(Base):
    """Campo customizado do formulário público de onboarding.

    Configurável por admin/gestor via /settings/onboarding-form.
    Respostas são armazenadas em Student.custom_fields (JSON dict).
    """

    __tablename__ = "onboarding_form_fields"

    id = Column(Integer, primary_key=True, index=True)

    # Chave técnica usada como chave no JSON de Student.custom_fields
    # (ex: "cpf", "area_atuacao"). Slug único, sem espaços.
    key = Column(String(60), unique=True, nullable=False, index=True)

    # Label exibido no formulário (ex: "CPF", "Área de atuação")
    label = Column(String(255), nullable=False)

    # Tipo do campo: "text" (texto curto) ou "select" (dropdown)
    # Entrega 2 limita a esses 2. Futuras entregas podem adicionar email,
    # phone, number, date, textarea, boolean, etc.
    type = Column(String(20), nullable=False, default="text")

    # Placeholder/helper visualizado no formulário (opcional)
    placeholder = Column(String(255), nullable=True)

    # Se o campo é obrigatório
    required = Column(Boolean, nullable=False, default=False)

    # Opções para type='select'. Lista de strings.
    # Ex: ["Sim", "Não"] ou ["São Paulo", "Rio de Janeiro", ...]
    options = Column(JSON, nullable=True, default=list)

    # Ordem de exibição (menor aparece primeiro). Reorderable via drag.
    order_index = Column(Integer, nullable=False, default=0, index=True)

    # Soft delete: campo inativo não aparece no form mas preserva respostas antigas
    active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
