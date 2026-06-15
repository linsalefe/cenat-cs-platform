import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class ConversationStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class MessageDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageSenderType(str, enum.Enum):
    STUDENT = "student"
    AGENT = "agent"
    BOT = "bot"
    SYSTEM = "system"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    contact_phone = Column(String(20), nullable=False, index=True)
    contact_name = Column(String(255), nullable=True)
    channel = Column(String(50), nullable=True, default="cs", index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(Enum(ConversationStatus), default=ConversationStatus.OPEN, nullable=False)
    last_message_at = Column(DateTime, nullable=True)
    last_message_preview = Column(String(255), nullable=True)
    unread_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", backref="conversations")
    assigned_to = relationship("User", backref="assigned_conversations")
    messages = relationship("ConversationMessage", back_populates="conversation", order_by="ConversationMessage.created_at")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    direction = Column(Enum(MessageDirection), nullable=False)
    sender_type = Column(Enum(MessageSenderType), nullable=False)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text", nullable=False)
    message_sid = Column(String(100), nullable=True)
    status = Column(String(50), default="sent")
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender_user = relationship("User")
