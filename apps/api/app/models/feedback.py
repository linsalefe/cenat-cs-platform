from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class FeedbackType(str, Enum):
    NPS = "nps"        # Net Promoter Score (0-10)
    CSAT = "csat"      # Customer Satisfaction (1-5)


class FeedbackTrigger(str, Enum):
    TICKET_CLOSED = "ticket_closed"       # Após fechar ticket
    COURSE_COMPLETED = "course_completed" # Após concluir curso
    MANUAL = "manual"                     # Disparo manual
    SCHEDULED = "scheduled"               # Disparo agendado


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    
    # Tipo e contexto
    feedback_type = Column(SQLEnum(FeedbackType), nullable=False)
    trigger = Column(SQLEnum(FeedbackTrigger), nullable=False)
    
    # Referência opcional (ticket_id, course_id, etc)
    reference_type = Column(String(50), nullable=True)  # "ticket", "course"
    reference_id = Column(Integer, nullable=True)
    
    # Resposta
    score = Column(Integer, nullable=True)  # NPS: 0-10, CSAT: 1-5
    comment = Column(Text, nullable=True)
    
    # Controle
    sent_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)
    token = Column(String(64), nullable=False, unique=True, index=True)  # Token único para resposta
    
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", backref="feedbacks")


def get_nps_category(score: int) -> str:
    """Classifica resposta NPS"""
    if score >= 9:
        return "promoter"
    elif score >= 7:
        return "passive"
    else:
        return "detractor"


def get_csat_category(score: int) -> str:
    """Classifica resposta CSAT"""
    if score >= 4:
        return "satisfied"
    elif score == 3:
        return "neutral"
    else:
        return "dissatisfied"
