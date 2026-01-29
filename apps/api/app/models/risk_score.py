from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    
    # Score final (0-100, quanto maior = mais risco)
    score = Column(Float, default=0.0)
    level = Column(SQLEnum(RiskLevel), default=RiskLevel.LOW)
    
    # Componentes do score
    engagement_score = Column(Float, default=0.0)  # Baseado em dias sem acesso
    progress_score = Column(Float, default=0.0)    # Baseado em progresso do curso
    grade_score = Column(Float, default=0.0)       # Baseado em notas
    financial_score = Column(Float, default=0.0)   # Baseado em inadimplência
    ticket_score = Column(Float, default=0.0)      # Baseado em reclamações
    nps_score = Column(Float, default=0.0)         # Baseado em NPS/CSAT
    
    # Detalhes
    factors = Column(String, nullable=True)  # JSON com fatores de risco
    
    # Controle
    calculated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", backref="risk_scores")
