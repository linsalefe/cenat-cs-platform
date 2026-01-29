from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Date
from sqlalchemy.orm import relationship

from app.db.base import Base


class MoodleSignal(Base):
    __tablename__ = "moodle_signals"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    moodle_user_id = Column(Integer, nullable=False, index=True)
    course_id = Column(Integer, nullable=False, index=True)
    
    # Progresso
    total_activities = Column(Integer, default=0)
    completed_activities = Column(Integer, default=0)
    progress_percent = Column(Float, default=0.0)
    
    # Notas
    course_grade = Column(Float, nullable=True)
    
    # Engajamento
    last_access = Column(DateTime, nullable=True)
    days_since_access = Column(Integer, default=0)
    
    # Controle
    captured_at = Column(Date, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", backref="moodle_signals")
