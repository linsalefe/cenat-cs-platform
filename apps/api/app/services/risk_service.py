import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.student import Student
from app.models.moodle_signal import MoodleSignal
from app.models.ticket import Ticket, TicketStatus, TicketCategory
from app.models.risk_score import RiskScore, RiskLevel
from app.models.feedback import Feedback, FeedbackType
from app.services.trend_service import analyze_student_trend


# ============================================================
# PESOS BASE DOS INDICADORES
# Se um indicador não tem dados, seu peso é redistribuído
# proporcionalmente entre os que têm dados.
# ============================================================
BASE_WEIGHTS = {
    "engagement":  0.20,   # dias sem acesso
    "attendance":  0.20,   # faltas em aulas ao vivo
    "academic":    0.20,   # notas
    "financial":   0.20,   # inadimplência (webhook ASAAS)
    "ticket":      0.10,   # reclamações
    "nps":         0.10,   # NPS/CSAT
}


# ============================================================
# CALCULADORES INDIVIDUAIS
# Retornam (score, has_data) — has_data indica se há dado real
# ============================================================

def calculate_engagement_score(days_since_access: int) -> float:
    """
    0 dias = 0, 60+ dias = 100.
    Curva não-linear: penaliza mais a partir de 14 dias.
    """
    if days_since_access <= 0:
        return 0.0
    if days_since_access >= 60:
        return 100.0
    if days_since_access <= 7:
        return (days_since_access / 7) * 10
    if days_since_access <= 14:
        return 10 + ((days_since_access - 7) / 7) * 20
    if days_since_access <= 30:
        return 30 + ((days_since_access - 14) / 16) * 40
    return 70 + ((days_since_access - 30) / 30) * 30


def calculate_academic_score(grades: list[float]) -> float:
    """
    Média de notas (cap 100). Nota alta = baixo risco.
    """
    if not grades:
        return 0.0
    normalized = [min(g, 100.0) for g in grades]
    avg = sum(normalized) / len(normalized)
    return max(0, min(100 - avg, 100))


def calculate_financial_score(status: str | None, overdue_value: float = 0) -> float:
    """
    Inadimplente com valor alto = risco máximo.
    """
    if not status or status == 'em_dia':
        return 0.0
    if status == 'pendente':
        return 35.0
    if status == 'inadimplente':
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
    if open_tickets == 0:
        return 0.0
    base = min(open_tickets * 20, 50)
    complaint = min(complaint_tickets * 30, 50)
    return min(base + complaint, 100)


def calculate_nps_score(db: Session, student_id: int) -> tuple[float, bool]:
    """Retorna (score, has_data)"""
    cutoff = datetime.utcnow() - timedelta(days=90)
    
    feedback = db.query(Feedback).filter(
        Feedback.student_id == student_id,
        Feedback.answered_at >= cutoff,
        Feedback.score.isnot(None),
    ).order_by(Feedback.answered_at.desc()).first()
    
    if not feedback:
        return 0.0, False
    
    if feedback.feedback_type == FeedbackType.NPS:
        if feedback.score >= 9:
            return 0.0, True
        elif feedback.score >= 7:
            return 40.0, True
        else:
            return 100.0, True
    else:
        if feedback.score >= 4:
            return 0.0, True
        elif feedback.score == 3:
            return 50.0, True
        else:
            return 100.0, True


def calculate_attendance_score(consecutive_absences: int, total_absences: int, total_sessions: int) -> float:
    """
    Risco baseado em faltas.
    8+ faltas consecutivas = risco máximo.
    Considera também % de faltas total.
    """
    if total_sessions == 0:
        return 0.0

    # Componente 1: faltas consecutivas recentes (peso maior)
    if consecutive_absences >= 8:
        consec_score = 100.0
    elif consecutive_absences >= 5:
        consec_score = 70.0
    elif consecutive_absences >= 3:
        consec_score = 40.0
    elif consecutive_absences >= 1:
        consec_score = 15.0
    else:
        consec_score = 0.0

    # Componente 2: % de faltas total
    absence_rate = (total_absences / total_sessions) * 100
    if absence_rate >= 50:
        rate_score = 80.0
    elif absence_rate >= 30:
        rate_score = 50.0
    elif absence_rate >= 15:
        rate_score = 25.0
    else:
        rate_score = 0.0

    # 70% consecutivas + 30% taxa total
    return min(consec_score * 0.7 + rate_score * 0.3, 100)


def determine_risk_level(score: float) -> RiskLevel:
    if score >= 75:
        return RiskLevel.CRITICAL
    if score >= 50:
        return RiskLevel.HIGH
    if score >= 25:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


# ============================================================
# CÁLCULO PRINCIPAL — SÓ PESA O QUE TEM DADO
# ============================================================

def calculate_student_risk(db: Session, student: Student) -> RiskScore:
    """
    Calcula risco usando apenas indicadores com dados reais.
    Pesos são redistribuídos dinamicamente.
    
    Sem dado = não entra no cálculo (não inflaciona).
    Sem NENHUM dado = score 0 + fator explicativo.
    """
    factors = []
    
    # Dicionário: indicador → (score, has_data)
    scores = {}
    
    # ── 1. ENGAJAMENTO ──
    moodle_signals = db.query(MoodleSignal).filter(
        MoodleSignal.student_id == student.id
    ).order_by(MoodleSignal.captured_at.desc()).all()
    
    has_moodle = len(moodle_signals) > 0
    
    if has_moodle:
        min_days = min(s.days_since_access or 999 for s in moodle_signals)
        if min_days == 999:
            min_days = 0
        
        eng_score = calculate_engagement_score(min_days)
        scores["engagement"] = (eng_score, True)
        
        if min_days > 30:
            factors.append(f"Sem acessar há {min_days} dias")
        elif min_days > 14:
            factors.append(f"Último acesso há {min_days} dias")
    else:
        scores["engagement"] = (0.0, False)
        factors.append("Sem dados de acesso ao Moodle")
    
    # ── 2. ACADÊMICO (notas) ──
    if has_moodle:
        grades = [s.course_grade for s in moodle_signals if s.course_grade is not None and s.course_grade >= 0]
        if grades:
            acad_score = calculate_academic_score(grades)
            scores["academic"] = (acad_score, True)
            
            normalized = [min(g, 100) for g in grades]
            avg_grade = sum(normalized) / len(normalized)
            if avg_grade < 50:
                factors.append(f"Média de notas baixa ({avg_grade:.1f})")
        else:
            scores["academic"] = (0.0, False)
    else:
        scores["academic"] = (0.0, False)
    
    # ── 3. FINANCEIRO ──
    has_financial = student.financial_status is not None
    
    if has_financial:
        fin_score = calculate_financial_score(
            student.financial_status,
            student.overdue_value or 0
        )
        scores["financial"] = (fin_score, True)
        
        if student.financial_status == 'inadimplente':
            factors.append(f"Inadimplente (R$ {student.overdue_value or 0:,.2f} em atraso)")
        elif student.financial_status == 'pendente':
            factors.append("Parcelas pendentes")
    else:
        scores["financial"] = (0.0, False)
    
    # ── 4. PRESENÇA (aulas ao vivo) ──
    has_attendance = (student.attendance_total or 0) > 0

    if has_attendance:
        att_score = calculate_attendance_score(
            student.attendance_consecutive_absences or 0,
            student.attendance_absences or 0,
            student.attendance_total or 0,
        )
        scores["attendance"] = (att_score, True)

        consec = student.attendance_consecutive_absences or 0
        total_abs = student.attendance_absences or 0
        total_sess = student.attendance_total or 0

        if consec >= 8:
            factors.append(f"{consec} faltas consecutivas recentes")
        elif consec >= 3:
            factors.append(f"{consec} faltas consecutivas recentes")

        if total_sess > 0:
            rate = (total_abs / total_sess) * 100
            if rate >= 30:
                factors.append(f"Taxa de faltas: {rate:.0f}%")
    else:
        scores["attendance"] = (0.0, False)

    # ── 5. TICKETS ──
    open_tickets = db.query(Ticket).filter(
        Ticket.student_id == student.id,
        Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_STUDENT])
    ).all()
    
    complaint_tickets = [t for t in open_tickets if t.category == TicketCategory.FINANCIAL]
    tkt_score = calculate_ticket_score(len(open_tickets), len(complaint_tickets))
    
    # Tickets: sempre tem "dado" (0 tickets = dado real de que está tudo ok)
    scores["ticket"] = (tkt_score, True)
    
    if len(open_tickets) > 0:
        factors.append(f"{len(open_tickets)} ticket(s) aberto(s)")
    if len(complaint_tickets) > 0:
        factors.append(f"{len(complaint_tickets)} reclamação(ões) financeira(s)")
    
    # ── 6. NPS/CSAT ──
    nps_val, nps_has_data = calculate_nps_score(db, student.id)
    scores["nps"] = (nps_val, nps_has_data)
    
    if nps_has_data and nps_val >= 70:
        factors.append("Feedback negativo")
    
    # ── 7. SCORE FINAL — PESOS DINÂMICOS ──
    # Só usa indicadores com dados reais
    active_weights = {}
    for key, (score, has_data) in scores.items():
        if has_data:
            active_weights[key] = BASE_WEIGHTS[key]
    
    # Redistribui pesos proporcionalmente
    total_active_weight = sum(active_weights.values())
    
    if total_active_weight == 0:
        # Nenhum dado disponível
        final_score = 0.0
        factors.append("Sem dados suficientes para calcular risco")
    else:
        final_score = 0.0
        for key, weight in active_weights.items():
            normalized_weight = weight / total_active_weight
            final_score += scores[key][0] * normalized_weight
    
    level = determine_risk_level(final_score)
    
    # ── 8. PERSISTE ──
    risk_score = db.query(RiskScore).filter(
        RiskScore.student_id == student.id
    ).first()
    
    if not risk_score:
        risk_score = RiskScore(student_id=student.id)
        db.add(risk_score)
    
    # Indicadores ativos (pra debug/transparência)
    active_indicators = [k for k, (s, has) in scores.items() if has]
    factors.append(f"Indicadores: {', '.join(active_indicators)} ({len(active_indicators)}/5)")
    
    risk_score.score = round(final_score, 2)
    risk_score.level = level
    risk_score.engagement_score = round(scores["engagement"][0], 2)
    risk_score.progress_score = round(scores.get("attendance", (0,))[0], 2)  # Reutiliza coluna pra attendance
    risk_score.grade_score = round(scores["academic"][0], 2)
    risk_score.financial_score = round(scores["financial"][0], 2)
    risk_score.ticket_score = round(scores["ticket"][0], 2)
    risk_score.nps_score = round(scores["nps"][0], 2)
    risk_score.factors = json.dumps(factors, ensure_ascii=False)
    risk_score.calculated_at = datetime.utcnow()
    
    db.flush()

    # Analisa tendência
    trend = analyze_student_trend(db, student, risk_score)
    if trend['overall'] == 'worsening':
        factors.append(f"Tendência de piora (Δ{trend['delta']:+.1f})")
    elif trend['overall'] == 'improving':
        factors.append(f"Tendência de melhora (Δ{trend['delta']:+.1f})")
    
    risk_score.factors = json.dumps(factors, ensure_ascii=False)

    db.commit()
    db.refresh(risk_score)
    
    return risk_score
