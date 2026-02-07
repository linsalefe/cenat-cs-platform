from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    moodle_user_id = Column(Integer, nullable=False, index=True)
    course_id = Column(Integer, nullable=False, index=True)
    attendance_id = Column(Integer, nullable=False)
    session_id = Column(Integer, nullable=False)
    session_date = Column(DateTime, nullable=False)
    status = Column(String(10), nullable=False)  # Pr, Au, At, Di
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('moodle_user_id', 'session_id', name='uq_attendance_user_session'),
    )

    student = relationship("Student", backref="attendance_records")
