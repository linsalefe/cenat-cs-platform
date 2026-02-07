from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base


class RiskHistory(Base):
    __tablename__ = "risk_history"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    score = Column(Float, default=0)
    engagement_score = Column(Float, default=0)
    attendance_score = Column(Float, default=0)
    academic_score = Column(Float, default=0)
    financial_score = Column(Float, default=0)
    ticket_score = Column(Float, default=0)
    nps_score = Column(Float, default=0)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('student_id', 'period_end', name='uq_risk_history_student_period'),
    )

    student = relationship("Student", backref="risk_history")
