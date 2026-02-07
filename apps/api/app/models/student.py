from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.db.base import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True, index=True)
    cpf = Column(String(14), unique=True, nullable=True, index=True)
    moodle_user_id = Column(Integer, unique=True, nullable=True, index=True)
    moodle_first_access = Column(DateTime, nullable=True)
    documents_count = Column(Integer, default=0)
    documents_total = Column(Integer, default=5)
    primary_course_id = Column(Integer, nullable=True)
    primary_course_name = Column(String(255), nullable=True)
    conta_azul_customer_id = Column(String(100), unique=True, nullable=True)
    asaas_customer_id = Column(String(100), unique=True, nullable=True, index=True)
    financial_status = Column(String(20), nullable=True)  # em_dia, pendente, inadimplente
    overdue_value = Column(Float, default=0)
    attendance_total = Column(Integer, default=0)
    attendance_absences = Column(Integer, default=0)
    attendance_consecutive_absences = Column(Integer, default=0)
    abandonment_status = Column(String(20), nullable=True)  # active, at_risk, abandoned
    risk_trend = Column(String(20), default='stable')  # improving, stable, worsening
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
