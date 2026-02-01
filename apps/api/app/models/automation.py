from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class Automation(Base):
    __tablename__ = "automations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Gatilho
    trigger_type = Column(String(100), nullable=False)
    # days_without_access, days_after_enrollment, first_login,
    # assignment_due_soon, nps_response, module_completed, inactive_student

    trigger_config = Column(JSON, nullable=False, default={})
    # Ex: {"days": 7} ou {"nps_min": 0, "nps_max": 6} ou {"days_before": 3}

    # Condições (filtros opcionais)
    conditions = Column(JSON, nullable=True, default={})
    # Ex: {"modality": "async", "financial_status": "adimplente"}

    # Ação
    action_type = Column(String(100), nullable=False)
    # send_whatsapp, send_email, create_ticket, notify_team

    action_config = Column(JSON, nullable=False, default={})
    # Ex: {"template": "Olá {name}, ...", "priority": "medium"}

    # Fase da jornada
    journey_phase = Column(String(100), nullable=True)
    # onboarding, first_classes, mid_course, conclusion, lock, re_enrollment

    # Status
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AutomationLog(Base):
    __tablename__ = "automation_logs"

    id = Column(Integer, primary_key=True, index=True)
    automation_id = Column(Integer, ForeignKey("automations.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    student_name = Column(String(255), nullable=True)

    action_type = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="success")
    # success, failed, skipped

    details = Column(JSON, nullable=True)
    # Ex: {"message_sid": "SM...", "phone": "..."} ou {"error": "..."}

    executed_at = Column(DateTime(timezone=True), server_default=func.now())
