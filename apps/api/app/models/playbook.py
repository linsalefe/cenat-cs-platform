from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.risk_score import RiskLevel


class ActionType(str, Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    TICKET = "ticket"
    NOTIFY_TEAM = "notify_team"


class Playbook(Base):
    __tablename__ = "playbooks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Trigger
    trigger_risk_level = Column(SQLEnum(RiskLevel), nullable=False)
    
    # Controle
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    actions = relationship("PlaybookAction", back_populates="playbook", order_by="PlaybookAction.order")


class PlaybookAction(Base):
    __tablename__ = "playbook_actions"

    id = Column(Integer, primary_key=True, index=True)
    playbook_id = Column(Integer, ForeignKey("playbooks.id"), nullable=False)
    
    order = Column(Integer, default=1)
    action_type = Column(SQLEnum(ActionType), nullable=False)
    
    # Configuração da ação
    template = Column(Text, nullable=True)  # Template da mensagem
    config = Column(Text, nullable=True)    # JSON com config adicional
    
    # Delay antes de executar (em horas)
    delay_hours = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    playbook = relationship("Playbook", back_populates="actions")


class PlaybookExecution(Base):
    __tablename__ = "playbook_executions"

    id = Column(Integer, primary_key=True, index=True)
    playbook_id = Column(Integer, ForeignKey("playbooks.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    result = Column(Text, nullable=True)  # JSON com resultado

    playbook = relationship("Playbook")
    student = relationship("Student")
