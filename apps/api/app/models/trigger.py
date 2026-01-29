from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class TriggerConditionType(str, Enum):
    DAYS_WITHOUT_ACCESS = "days_without_access"      # Dias sem acessar o Moodle
    PROGRESS_BELOW = "progress_below"                 # Progresso abaixo de X%
    GRADE_BELOW = "grade_below"                       # Nota abaixo de X
    RISK_LEVEL = "risk_level"                         # Nível de risco
    # Futuro (ASAAS)
    OVERDUE_DAYS = "overdue_days"                     # Dias de inadimplência


class TriggerActionType(str, Enum):
    SEND_WHATSAPP = "send_whatsapp"
    SEND_EMAIL = "send_email"
    CREATE_TICKET = "create_ticket"
    NOTIFY_TEAM = "notify_team"


class Trigger(Base):
    __tablename__ = "triggers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Condição
    condition_type = Column(SQLEnum(TriggerConditionType), nullable=False)
    condition_value = Column(String(50), nullable=False)  # Ex: "10" para 10 dias
    
    # Ação
    action_type = Column(SQLEnum(TriggerActionType), nullable=False)
    action_template = Column(Text, nullable=True)  # Template da mensagem
    
    # Controle de execução
    cooldown_days = Column(Integer, default=7)  # Não repetir para mesmo aluno em X dias
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TriggerExecution(Base):
    __tablename__ = "trigger_executions"

    id = Column(Integer, primary_key=True, index=True)
    trigger_id = Column(Integer, nullable=False, index=True)
    student_id = Column(Integer, nullable=False, index=True)
    
    status = Column(String(20), default="executed")  # executed, failed
    result = Column(Text, nullable=True)
    
    executed_at = Column(DateTime, default=datetime.utcnow)
