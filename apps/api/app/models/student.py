from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.db.base import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True, index=True)
    cpf = Column(String(14), unique=True, nullable=True, index=True)
    moodle_user_id = Column(Integer, unique=True, nullable=True, index=True)
    conta_azul_customer_id = Column(String(100), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
