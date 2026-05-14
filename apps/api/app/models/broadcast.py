from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Float
from sqlalchemy.sql import func
from app.db.base import Base


class Broadcast(Base):
    __tablename__ = "broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Canal WhatsApp (slug: cs, secretaria, financeiro, pedagogico)
    channel = Column(String(50), nullable=False, default="cs")

    # Filtros de seleção de alunos
    filters = Column(JSON, nullable=False, default={})
    # Ex: {
    #   "login_status": "never",
    #   "docs_status": "none",
    #   "financial_status": "inadimplente",
    #   "course_id": 5,
    #   "days_without_access_min": 7
    # }

    # Template Meta WhatsApp
    template_name = Column(String(255), nullable=False)
    # Ex: "boas_vindas", "lembrete_acesso", "lembrete_pagamento"

    template_language = Column(String(10), nullable=False, default="pt_BR")

    template_params = Column(JSON, nullable=False, default=[])
    # Mapeamento dos parâmetros do template
    # Ex: ["{name}", "{course}"] → substituídos por dados do aluno

    # Origem dos destinatários
    source_type = Column(String(20), nullable=False, default="filters")
    # "filters" → usa `filters` + query em students
    # "csv"     → usa `csv_recipients` (lista de dicts)

    csv_recipients = Column(JSON, nullable=False, default=list)
    # Quando source_type="csv":
    # [{"phone": "5583999999999", "name": "João", "vars": {"curso": "Pos X", "matricula": "123"}}]

    # Status do disparo
    status = Column(String(50), nullable=False, default="draft")
    # draft, sending, completed, partial, failed, cancelled

    # Estatísticas (atualizadas durante o envio)
    total_students = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)

    # Controle
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class BroadcastLog(Base):
    __tablename__ = "broadcast_logs"

    id = Column(Integer, primary_key=True, index=True)
    broadcast_id = Column(Integer, ForeignKey("broadcasts.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    # nullable pra suportar disparo CSV de destinatários fora da base
    student_name = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    extra_data = Column(JSON, nullable=False, default=dict)
    # vars do recipient quando source=csv (curso, matricula, etc)

    # Status do envio individual
    status = Column(String(50), nullable=False, default="pending")
    # pending, sent, delivered, read, failed

    # Resposta da Meta API
    message_id = Column(String(255), nullable=True)
    # Ex: "wamid.HBgNNTU4NDk..."

    error = Column(Text, nullable=True)
    # Ex: "Número inválido" ou "Rate limit exceeded"

    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())