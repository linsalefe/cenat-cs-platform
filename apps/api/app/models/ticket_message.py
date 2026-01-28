import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class MessageSender(str, enum.Enum):
    STUDENT = "student"
    STAFF = "staff"
    SYSTEM = "system"


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    sender_type = Column(Enum(MessageSender), nullable=False)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", backref="messages")
    sender_user = relationship("User", backref="sent_messages")
