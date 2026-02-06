import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.student import Student
from app.models.moodle_signal import MoodleSignal
from app.models.ticket import Ticket, TicketStatus, TicketCategory
from app.models.risk_score import RiskScore, RiskLevel
from app.models.feedback import Feedback, FeedbackType


# ============================================================
# PESOS DOS INDICADORES (total = 100%)
# ============================================================
# Redistribuído: progresso tinha 25% mas dados são quebrados
# Financial subiu porque agora temos dados em tempo real (webhook)
WEIGHTS = {
    "engagement": 0.30,   # 30% - dias sem acesso (sinal mais forte de evasão)
    "academic":   0.25,   # 25% - notas (único dado acadêmico confiável)
    "financial":  0.25,   # 25% - inadimplência (dados em tempo real via webhook)
    "ticket":     0.10,   # 10% - reclamações abertas
    "nps":        0.10,   # 10% - NPS/CSAT
}

# Score padrão quando não há dados (risco moderado, não zero)
DEFAULT_NO_DATA = 40.0


# ============================================================
# CALCULADORES INDIVIDUAIS
# ============================================================

def calculate_engagement_score(days_since_access: int) -> float:
    """
    Risco baseado em dias sem acesso.
    0 dias = 0 (sem risco), 60+ dias = 100 (risco máximo)
    
    Escala de 60 dias (não 30) porque EAD tem acessos menos frequentes.
    Curva não-linear: penaliza mais a partir de 14 dias.
    """
    if days_since_access <= 0:
        return 0.0
    if days_since_access >= 60:
        return 100.0
    if days_since_access <= 7:
        # 0-7 dias: risco baixo (0-10)
        return (days_since_access / 7) * 10
    if days_since_access <= 14:
        # 8-14 dias: risco crescendo (10-30)
        return 10 + ((days_since_access - 7) / 7) * 20
    if days_since_access <= 30:
        # 15-30 dias: risco moderado-alto (30-70)
        return 30 + ((days_since_access - 14) / 16) * 40
    # 31-60 dias: risco alto (70-100)
    return 70 + ((days_since_access - 30) / 30) * 30


def calculate_academic_score(grades: list[float]) -> float:
    """
    Risco baseado em notas. Usa MÉDIA (não pior nota).
    Notas são normalizadas: cap em 100.
    
    Média >= 70 = baixo risco, < 30 = risco máximo
    """
    if not grades:
        return DEFAULT_NO_DATA  # Sem notas = risco moderado
    
    # Normaliza: cap em 100 (Moodle pode retornar > 100)
    normalized = [min(g, 100.0) for g in grades]
    avg = sum(normalized) / len(normalized)
    
    # Inverte: nota alta = baixo risco
    return max(0, min(100 - avg, 100))


def calculate_financial_score(status: str | None, overdue_value: float = 0) -> float:
    """
    Risco baseado no status financeiro (ASAAS em tempo real).
    Inadimplente com valor alto = risco máximo.
    """
    if not status or status == 'em_dia':
        return 0.0
    if status == 'pendente':
        return 35.0
    if status == 'inadimplente':
        # Escala com valor em atraso
        if overdue_value >= 1000:
            return 100.0
        elif overdue_value >= 500:
            return 85.0
        elif overdue_value >= 200:
            return 70.0
        else:
            return 60.0
    return 0.0


def calculate_ticket_score(open_tickets: int, complaint_tickets: int) -> float:
    """
    Risco baseado em tickets abertos.
    Tickets financeiros pesam mais que tickets gerais.
    """
    if open_tickets == 0:
        return 0.0
    base = min(open_tickets * 20, 50)
    complaint = min(complaint_tickets * 30, 50)
    return min(base + complaint, 100)


def calculate_nps_score(db: Session, student_id: int) -> float:
    """
    Risco baseado no último NPS/CSAT (últimos 90 dias).
    Sem feedback = risco moderado (não zero).
    """
    cutoff = datetime.utcnow() - timedelta(days=90)
    
    feedback = db.query(Feedback).filter(
        Feedback.student_id == student_id,
        Feedback.answered_at >= cutoff,
        Feedback.score.isnot(None),
    ).order_by(Feedback.answered_at.desc()).first()
    
    if not feedback:
        return DEFAULT_NO_DATA  # Sem feedback = risco moderado
    
    if feedback.feedback_type == FeedbackType.NPS:
        if feedback.score >= 9:
            return 0.0
        elif feedback.score >= 7:
            return 40.0
        else:
            return 100.0
    else:
        if feedback.score >= 4:
            return 0.0
        elif feedback.score == 3:
            return 50.0
        else:
            return 100.0


def determine_risk_level(score: float) -> RiskLevel:
    """Determina nível de risco baseado no score"""
    if score >= 75:
        return RiskLevel.CRITICAL
    if score >= 50:
        return RiskLevel.HIGH
    if score >= 25:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


# ============================================================
# CÁLCULO PRINCIPAL
# ============================================================

def calculate_student_risk(db: Session, student: Student) -> RiskScore:
    """
    Calcula o score de risco de um aluno.
    
    Correções aplicadas:
    1. Engajamento usa MENOR days_since_access (acesso mais recente)
    2. Progresso removido (dados não confiáveis do Moodle)
    3. Notas: MÉDIA com cap em 100 (não pior nota)
    4. Sem dados = risco moderado (40), não zero
    5. Escala de engajamento: 60 dias (mais realista pra EAD)
    6. Financeiro gradual (valor em atraso influencia)
    """
    factors = []
    
    # ── 1. ENGAJAMENTO (dias sem acesso) ──
    moodle_signals = db.query(MoodleSignal).filter(
        MoodleSignal.student_id == student.id
    ).order_by(MoodleSignal.captured_at.desc()).all()
    
    if moodle_signals:
        # Usa o MENOR days_since_access (acesso mais recente em qualquer curso)
        min_days = min(s.days_since_access or 999 for s in moodle_signals)
        if min_days == 999:
            min_days = 0
        
        engagement_score = calculate_engagement_score(min_days)
        
        if min_days > 14:
            factors.append(f"Sem acessar há {min_days} dias")
        elif min_days > 7:
            factors.append(f"Último acesso há {min_days} dias")
    else:
        # Aluno sem nenhum sinal do Moodle = risco moderado
        engagement_score = DEFAULT_NO_DATA
        factors.append("Sem dados de acesso ao Moodle")
    
    # ── 2. ACADÊMICO (notas) ──
    if moodle_signals:
        grades = [s.course_grade for s in moodle_signals if s.course_grade is not None and s.course_grade >= 0]
        academic_score = calculate_academic_score(grades)
        
        if grades:
            normalized = [min(g, 100) for g in grades]
            avg_grade = sum(normalized) / len(normalized)
            if avg_grade < 50:
                factors.append(f"Média de notas baixa ({avg_grade:.1f})")
        else:
            factors.append("Sem notas registradas")
    else:
        academic_score = DEFAULT_NO_DATA
    
    # ── 3. FINANCEIRO (ASAAS em tempo real) ──
    financial_score = calculate_financial_score(
        student.financial_status,
        student.overdue_value or 0
    )
    
    if student.financial_status == 'inadimplente':
        factors.append(f"Inadimplente (R$ {student.overdue_value or 0:,.2f} em atraso)")
    elif student.financial_status == 'pendente':
        factors.append("Parcelas pendentes")
    
    # ── 4. TICKETS ──
    open_tickets = db.query(Ticket).filter(
        Ticket.student_id == student.id,
        Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_STUDENT])
    ).all()
    
    complaint_tickets = [t for t in open_tickets if t.category == TicketCategory.FINANCIAL]
    ticket_score = calculate_ticket_score(len(open_tickets), len(complaint_tickets))
    
    if len(open_tickets) > 0:
        factors.append(f"{len(open_tickets)} ticket(s) aberto(s)")
    if len(complaint_tickets) > 0:
        factors.append(f"{len(complaint_tickets)} reclamação(ões) financeira(s)")
    
    # ── 5. NPS/CSAT ──
    nps_score = calculate_nps_score(db, student.id)
    if nps_score >= 70:
        factors.append("Feedback negativo")
    
    # ── 6. SCORE FINAL PONDERADO ──
    final_score = (
        engagement_score * WEIGHTS["engagement"] +
        academic_score * WEIGHTS["academic"] +
        financial_score * WEIGHTS["financial"] +
        ticket_score * WEIGHTS["ticket"] +
        nps_score * WEIGHTS["nps"]
    )
    
    level = determine_risk_level(final_score)
    
    # ── 7. PERSISTE ──
    risk_score = db.query(RiskScore).filter(
        RiskScore.student_id == student.id
    ).first()
    
    if not risk_score:
        risk_score = RiskScore(student_id=student.id)
        db.add(risk_score)
    
    risk_score.score = round(final_score, 2)
    risk_score.level = level
    risk_score.engagement_score = round(engagement_score, 2)
    risk_score.progress_score = 0.0  # Mantém coluna mas zerada (dado não confiável)
    risk_score.grade_score = round(academic_score, 2)
    risk_score.financial_score = round(financial_score, 2)
    risk_score.ticket_score = round(ticket_score, 2)
    risk_score.nps_score = round(nps_score, 2)
    risk_score.factors = json.dumps(factors, ensure_ascii=False)
    risk_score.calculated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(risk_score)
    
    return risk_score
