"""
Serviço de análise de tendência.

Compara indicadores em 2 janelas temporais:
- Período recente: últimas 4 semanas
- Período anterior: 4 semanas antes disso

Tendência por indicador:
- Presença: taxa de faltas recente vs anterior
- Financeiro: status atual vs status 4 semanas atrás
- Engajamento: dias sem acesso (comparação de snapshots)

Tendência geral:
- Score atual vs score do período anterior (salvo no risk_history)
"""

from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.student import Student
from app.models.attendance import AttendanceRecord
from app.models.risk_score import RiskScore
from app.models.risk_history import RiskHistory


# Thresholds pra classificar tendência
WORSENING_THRESHOLD = 5.0   # Score subiu 5+ pontos = piorando
IMPROVING_THRESHOLD = -5.0   # Score caiu 5+ pontos = melhorando


def classify_trend(delta: float) -> str:
    """Classifica tendência baseada na variação"""
    if delta >= WORSENING_THRESHOLD:
        return "worsening"
    elif delta <= IMPROVING_THRESHOLD:
        return "improving"
    return "stable"


def calculate_attendance_trend(db: Session, student: Student) -> tuple[str, float]:
    """
    Compara taxa de faltas das últimas 4 semanas vs 4 semanas anteriores.
    Retorna (trend, delta_percentage_points)
    """
    now = datetime.utcnow()
    recent_start = now - timedelta(weeks=4)
    previous_start = now - timedelta(weeks=8)

    # Período recente (últimas 4 semanas)
    recent = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.session_date >= recent_start,
    ).all()

    # Período anterior (4-8 semanas atrás)
    previous = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.session_date >= previous_start,
        AttendanceRecord.session_date < recent_start,
    ).all()

    if not recent and not previous:
        return "stable", 0.0

    recent_total = len(recent)
    recent_absences = sum(1 for r in recent if r.status == "Au")
    recent_rate = (recent_absences / recent_total * 100) if recent_total > 0 else 0

    prev_total = len(previous)
    prev_absences = sum(1 for r in previous if r.status == "Au")
    prev_rate = (prev_absences / prev_total * 100) if prev_total > 0 else 0

    # Se não tem período anterior, não dá pra comparar
    if prev_total == 0:
        return "stable", 0.0

    # Delta positivo = mais faltas = piorando
    delta = recent_rate - prev_rate
    trend = classify_trend(delta)

    return trend, round(delta, 2)


def calculate_financial_trend(student: Student) -> str:
    """
    Tendência financeira baseada no status + valor.
    Como não temos histórico de status, usamos o valor em atraso como proxy.
    """
    if not student.financial_status:
        return "stable"

    # Inadimplente com valor alto = já piorou
    if student.financial_status == "inadimplente":
        if (student.overdue_value or 0) >= 500:
            return "worsening"
        return "worsening"
    elif student.financial_status == "pendente":
        return "stable"  # Pode ir pra qualquer lado
    return "stable"


def calculate_engagement_trend(db: Session, student: Student) -> str:
    """
    Compara days_since_access atual com o valor de 4 semanas atrás.
    Se days_since subiu muito, está piorando.
    
    Como só temos 1 snapshot (captured_at), usamos a data de captura
    e o days_since_access pra estimar.
    """
    from app.models.moodle_signal import MoodleSignal

    signals = db.query(MoodleSignal).filter(
        MoodleSignal.student_id == student.id
    ).order_by(MoodleSignal.captured_at.desc()).all()

    if not signals:
        return "stable"

    # Acesso mais recente
    min_days = min(s.days_since_access or 999 for s in signals)
    if min_days == 999:
        return "stable"

    # Se days_since > 30 e tem sinais de presença recente = contradição, usa presença
    # Se days_since está entre 14-60 = alerta
    if min_days >= 30:
        return "worsening"
    elif min_days >= 14:
        return "stable"  # Zona cinza
    return "stable"


def save_risk_snapshot(db: Session, student: Student, risk: RiskScore):
    """Salva snapshot semanal do risco pra histórico"""
    today = date.today()
    # Arredonda pra segunda-feira da semana
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    existing = db.query(RiskHistory).filter(
        RiskHistory.student_id == student.id,
        RiskHistory.period_end == week_end,
    ).first()

    if existing:
        # Atualiza snapshot da semana
        existing.score = risk.score
        existing.engagement_score = risk.engagement_score
        existing.attendance_score = risk.progress_score  # reutilizamos coluna
        existing.academic_score = risk.grade_score
        existing.financial_score = risk.financial_score
        existing.ticket_score = risk.ticket_score
        existing.nps_score = risk.nps_score
    else:
        snapshot = RiskHistory(
            student_id=student.id,
            score=risk.score,
            engagement_score=risk.engagement_score,
            attendance_score=risk.progress_score,
            academic_score=risk.grade_score,
            financial_score=risk.financial_score,
            ticket_score=risk.ticket_score,
            nps_score=risk.nps_score,
            period_start=week_start,
            period_end=week_end,
        )
        db.add(snapshot)


def calculate_overall_trend(db: Session, student: Student, current_score: float) -> tuple[str, float]:
    """
    Compara score atual com o score de 4 semanas atrás.
    Retorna (trend, delta)
    """
    cutoff = date.today() - timedelta(weeks=4)

    previous = db.query(RiskHistory).filter(
        RiskHistory.student_id == student.id,
        RiskHistory.period_end <= cutoff,
    ).order_by(RiskHistory.period_end.desc()).first()

    if not previous:
        return "stable", 0.0

    delta = current_score - previous.score
    trend = classify_trend(delta)

    return trend, round(delta, 2)


def analyze_student_trend(db: Session, student: Student, risk: RiskScore) -> dict:
    """
    Análise completa de tendência de um aluno.
    Chamada após calcular o score de risco.
    """
    # 1. Tendência por indicador
    att_trend, att_delta = calculate_attendance_trend(db, student)
    fin_trend = calculate_financial_trend(student)
    eng_trend = calculate_engagement_trend(db, student)

    # 2. Tendência geral (score vs histórico)
    overall_trend, overall_delta = calculate_overall_trend(db, student, risk.score)

    # 3. Se não tem histórico ainda, infere da combinação de indicadores
    if overall_delta == 0:
        # Conta quantos indicadores estão piorando
        trends = [att_trend, fin_trend, eng_trend]
        worsening_count = trends.count("worsening")
        improving_count = trends.count("improving")

        if worsening_count >= 2:
            overall_trend = "worsening"
            overall_delta = 10.0  # Estimativa
        elif improving_count >= 2:
            overall_trend = "improving"
            overall_delta = -10.0

    # 4. Atualiza risk_score
    risk.trend = overall_trend
    risk.trend_delta = overall_delta
    risk.attendance_trend = att_trend
    risk.financial_trend = fin_trend
    risk.engagement_trend = eng_trend

    # 5. Atualiza student
    student.risk_trend = overall_trend

    # 6. Salva snapshot
    save_risk_snapshot(db, student, risk)

    return {
        "overall": overall_trend,
        "delta": overall_delta,
        "attendance": {"trend": att_trend, "delta": att_delta},
        "financial": {"trend": fin_trend},
        "engagement": {"trend": eng_trend},
    }
