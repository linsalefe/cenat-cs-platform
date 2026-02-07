from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey, Float
from sqlalchemy.sql import func
from app.db.base import Base


class JourneyRule(Base):
    """Régua de jornada — sequência de mensagens automáticas"""
    __tablename__ = "journey_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Gatilho que inicia a régua
    trigger_type = Column(String(100), nullable=False)
    # new_enrollment, first_login, payment_overdue, days_without_access
    trigger_config = Column(JSON, nullable=False, default={})
    # Ex: {"days": 7} para days_without_access

    # Canal WhatsApp
    channel = Column(String(50), nullable=False, default="cs")

    # Condições extras (filtros)
    conditions = Column(JSON, nullable=True, default={})
    # Ex: {"course_id": 5, "financial_status": "inadimplente"}

    # Comportamento ao aluno responder
    on_reply = Column(String(50), nullable=False, default="pause")
    # pause = pausa régua e direciona para humano
    # continue = continua régua normalmente
    # stop = para régua definitivamente

    # Controle
    max_steps = Column(Integer, default=10)
    is_active = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class JourneyStep(Base):
    """Step individual da régua — cada mensagem da sequência"""
    __tablename__ = "journey_steps"

    id = Column(Integer, primary_key=True, index=True)
    journey_rule_id = Column(Integer, ForeignKey("journey_rules.id", ondelete="CASCADE"), nullable=False)

    # Ordem e timing
    step_order = Column(Integer, nullable=False)  # 1, 2, 3...
    delay_days = Column(Integer, nullable=False, default=0)  # dias após step anterior (0 = imediato)
    delay_hours = Column(Integer, nullable=False, default=0)  # horas adicionais

    # Template WhatsApp
    template_name = Column(String(255), nullable=False)
    template_language = Column(String(10), default="pt_BR")
    template_params = Column(JSON, default=[])  # ["{{primeiro_nome}}", "{{curso}}"]

    # Botões interativos (até 3)
    buttons = Column(JSON, default=[])
    # Ex: [
    #   {"id": "btn_acessei", "text": "Já acessei ✅", "action": "stop"},
    #   {"id": "btn_ajuda", "text": "Preciso de ajuda 🆘", "action": "handoff"},
    #   {"id": "btn_lembrar", "text": "Me lembre depois 🔔", "action": "continue"}
    # ]
    # action: stop (para régua), handoff (humano assume), continue (segue), skip_to (pula pro step X)

    # Descrição visual
    title = Column(String(255), nullable=True)  # "Boas-vindas", "Lembrete de acesso"

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StudentJourney(Base):
    """Acompanhamento individual do aluno na régua"""
    __tablename__ = "student_journeys"

    id = Column(Integer, primary_key=True, index=True)
    journey_rule_id = Column(Integer, ForeignKey("journey_rules.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    student_name = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)

    # Progresso
    current_step = Column(Integer, default=0)  # 0 = não iniciou, 1 = step 1, etc
    status = Column(String(30), default="active")
    # active, paused, completed, stopped, failed

    # Tracking
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    next_step_at = Column(DateTime(timezone=True), nullable=True)  # quando enviar o próximo step
    paused_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Log de botão clicado (último)
    last_button_clicked = Column(String(100), nullable=True)
    last_button_at = Column(DateTime(timezone=True), nullable=True)

    # Mensagens enviadas/falhadas
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())