import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.student import Student
from app.models.moodle_signal import MoodleSignal
from app.models.ticket import Ticket, TicketStatus, TicketCategory
from app.models.risk_score import RiskScore, RiskLevel
from app.models.feedback import Feedback, FeedbackType


# Pesos dos indicadores (total = 100%)
WEIGHTS = {
    "engagement": 0.25,   # 25% - dias sem acesso
    "progress": 0.25,     # 25% - progresso no curso
    "grade": 0.15,        # 15% - notas
    "financial": 0.15,    # 15% - inadimplência (ASAAS)
    "ticket": 0.10,       # 10% - reclamações abertas
    "nps": 0.10,          # 10% - NPS/CSAT
}


def calculate_engagement_score(days_since_access: int) -> float:
    """
    Calcula score de engajamento baseado em dias sem acesso.
    0 dias = 0 (sem risco), 30+ dias = 100 (risco máximo)
    """
    if days_since_access <= 0:
        return 0.0
    if days_since_access >= 30:
        return 100.0
    return (days_since_access / 30) * 100


def calculate_progress_score(progress_percent: float) -> float:
    """
    Calcula score de risco baseado em progresso.
    100% progresso = 0 (sem risco), 0% = 100 (risco máximo)
    """
    return 100 - progress_percent


def calculate_grade_score(grade: float | None, max_grade: float = 100) -> float:
    """
    Calcula score de risco baseado em notas.
    Nota máxima = 0 (sem risco), nota 0 = 100 (risco máximo)
    """
    if grade is None:
        return 50.0  # Sem nota = risco médio
    
    normalized = min(grade / max_grade * 100, 100)
    return 100 - normalized


def calculate_ticket_score(open_tickets: int, complaint_tickets: int) -> float:
    """
    Calcula score baseado em tickets abertos.
    Mais tickets de reclamação = mais risco
    """
    base_score = min(open_tickets * 15, 50)
    complaint_score = min(complaint_tickets * 25, 50)
    return min(base_score + complaint_score, 100)


def calculate_nps_score(db: Session, student_id: int) -> float:
    """
    Calcula score de risco baseado em NPS/CSAT.
    Promoter/Satisfied = 0, Detractor/Dissatisfied = 100
    """
    # Busca último feedback respondido nos últimos 90 dias
    cutoff = datetime.utcnow() - timedelta(days=90)
    
    feedback = db.query(Feedback).filter(
        Feedback.student_id == student_id,
        Feedback.answered_at >= cutoff,
        Feedback.score.isnot(None),
    ).order_by(Feedback.answered_at.desc()).first()
    
    if not feedback:
        return 50.0  # Sem feedback = risco médio
    
    if feedback.feedback_type == FeedbackType.NPS:
        # NPS: 0-10
        # 9-10 = Promoter (baixo risco), 7-8 = Passive (médio), 0-6 = Detractor (alto)
        if feedback.score >= 9:
            return 0.0
        elif feedback.score >= 7:
            return 40.0
        else:
            return 100.0
    else:
        # CSAT: 1-5
        # 4-5 = Satisfied (baixo risco), 3 = Neutral (médio), 1-2 = Dissatisfied (alto)
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


def calculate_student_risk(db: Session, student: Student) -> RiskScore:
    """Calcula o score de risco de um aluno"""
    factors = []
    
    # 1. Busca sinais do Moodle (mais recentes)
    moodle_signals = db.query(MoodleSignal).filter(
        MoodleSignal.student_id == student.id
    ).order_by(MoodleSignal.captured_at.desc()).all()
    
    # Calcula médias dos sinais do Moodle
    if moodle_signals:
        avg_days_since = sum(s.days_since_access or 0 for s in moodle_signals) / len(moodle_signals)
        avg_progress = sum(s.progress_percent or 0 for s in moodle_signals) / len(moodle_signals)
        
        # Pega a pior nota (mais baixa)
        grades = [s.course_grade for s in moodle_signals if s.course_grade is not None]
        avg_grade = min(grades) if grades else None
        
        engagement_score = calculate_engagement_score(int(avg_days_since))
        progress_score = calculate_progress_score(avg_progress)
        grade_score = calculate_grade_score(avg_grade)
        
        if avg_days_since > 14:
            factors.append(f"Sem acessar há {int(avg_days_since)} dias")
        if avg_progress < 30:
            factors.append(f"Progresso baixo ({avg_progress:.0f}%)")
        if avg_grade is not None and avg_grade < 60:
            factors.append(f"Nota baixa ({avg_grade:.1f})")
    else:
        engagement_score = 50.0  # Sem dados = risco médio
        progress_score = 50.0
        grade_score = 50.0
        factors.append("Sem dados do Moodle")
    
    # 2. Busca tickets abertos
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
    
    # 3. Financial score (placeholder - será implementado com ASAAS)
    financial_score = 0.0
    
    # 4. NPS/CSAT score
    nps_score = calculate_nps_score(db, student.id)
    if nps_score >= 70:
        factors.append("Feedback negativo")
    
    # 5. Calcula score final ponderado
    final_score = (
        engagement_score * WEIGHTS["engagement"] +
        progress_score * WEIGHTS["progress"] +
        grade_score * WEIGHTS["grade"] +
        financial_score * WEIGHTS["financial"] +
        ticket_score * WEIGHTS["ticket"] +
        nps_score * WEIGHTS["nps"]
    )
    
    level = determine_risk_level(final_score)
    
    # 6. Cria ou atualiza registro
    risk_score = db.query(RiskScore).filter(
        RiskScore.student_id == student.id
    ).first()
    
    if not risk_score:
        risk_score = RiskScore(student_id=student.id)
        db.add(risk_score)
    
    risk_score.score = final_score
    risk_score.level = level
    risk_score.engagement_score = engagement_score
    risk_score.progress_score = progress_score
    risk_score.grade_score = grade_score
    risk_score.financial_score = financial_score
    risk_score.ticket_score = ticket_score
    risk_score.nps_score = nps_score
    risk_score.factors = json.dumps(factors, ensure_ascii=False)
    risk_score.calculated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(risk_score)
    
    return risk_score
