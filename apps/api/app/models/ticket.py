import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_STUDENT = "waiting_student"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketCategory(str, enum.Enum):
    FINANCIAL = "financial"
    ACADEMIC = "academic"
    TECHNICAL = "technical"
    ADMINISTRATIVE = "administrative"
    OTHER = "other"


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    protocol = Column(String(50), unique=True, nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(Enum(TicketStatus), nullable=False, default=TicketStatus.OPEN)
    category = Column(Enum(TicketCategory), nullable=False, default=TicketCategory.OTHER)
    priority = Column(Enum(TicketPriority), nullable=False, default=TicketPriority.MEDIUM)
    subject = Column(String(255), nullable=True)
    sla_deadline = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", backref="tickets")
    assigned_to = relationship("User", backref="tickets")
