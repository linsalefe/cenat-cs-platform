from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class TicketStatusHistory(Base):
    __tablename__ = "ticket_status_history"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", backref="status_history")
    changed_by = relationship("User", backref="ticket_changes")
