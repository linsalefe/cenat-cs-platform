from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.ticket import Ticket, TicketStatus, TicketCategory
from app.models.risk_score import RiskScore, RiskLevel
from app.models.moodle_signal import MoodleSignal
from app.models.feedback import Feedback, FeedbackType

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/overview")
def get_overview_metrics(
    days: int = Query(30, description="Período em dias"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna métricas gerais do sistema"""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Total de alunos
    total_students = db.query(func.count(Student.id)).scalar()
    
    # Alunos por nível de risco
    risk_counts = db.query(
        RiskScore.level,
        func.count(RiskScore.id)
    ).group_by(RiskScore.level).all()
    
    risk_summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for level, count in risk_counts:
        risk_summary[level.value] = count
    
    # Tickets no período
    tickets_period = db.query(func.count(Ticket.id)).filter(
        Ticket.created_at >= cutoff
    ).scalar()
    
    tickets_open = db.query(func.count(Ticket.id)).filter(
        Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_STUDENT])
    ).scalar()
    
    tickets_closed = db.query(func.count(Ticket.id)).filter(
        Ticket.status.in_([TicketStatus.RESOLVED, TicketStatus.CLOSED]),
        Ticket.resolved_at >= cutoff
    ).scalar()
    
    # Tempo médio de resolução (em horas)
    resolved_tickets = db.query(Ticket).filter(
        Ticket.resolved_at.isnot(None),
        Ticket.resolved_at >= cutoff
    ).all()
    
    avg_resolution_hours = None
    if resolved_tickets:
        total_hours = sum(
            (t.resolved_at - t.created_at).total_seconds() / 3600 
            for t in resolved_tickets
        )
        avg_resolution_hours = round(total_hours / len(resolved_tickets), 1)
    
    # SLA cumprido
    sla_met = sum(1 for t in resolved_tickets if t.resolved_at <= t.sla_deadline)
    sla_percentage = round((sla_met / len(resolved_tickets)) * 100, 1) if resolved_tickets else None
    
    return {
        "period_days": days,
        "students": {
            "total": total_students,
            "at_risk": risk_summary["critical"] + risk_summary["high"],
            "risk_breakdown": risk_summary,
        },
        "tickets": {
            "created_period": tickets_period,
            "open": tickets_open,
            "closed_period": tickets_closed,
            "avg_resolution_hours": avg_resolution_hours,
            "sla_percentage": sla_percentage,
        },
    }


@router.get("/tickets")
def get_ticket_metrics(
    days: int = Query(30, description="Período em dias"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna métricas detalhadas de tickets"""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Por categoria
    by_category = db.query(
        Ticket.category,
        func.count(Ticket.id)
    ).filter(Ticket.created_at >= cutoff).group_by(Ticket.category).all()
    
    category_labels = {
        TicketCategory.FINANCIAL: "Financeiro",
        TicketCategory.ACADEMIC: "Acadêmico",
        TicketCategory.TECHNICAL: "Técnico",
        TicketCategory.ADMINISTRATIVE: "Administrativo",
        TicketCategory.OTHER: "Outro",
    }
    
    categories = [
        {"category": category_labels.get(cat, cat.value), "count": count}
        for cat, count in by_category
    ]
    
    # Por status
    by_status = db.query(
        Ticket.status,
        func.count(Ticket.id)
    ).group_by(Ticket.status).all()
    
    status_labels = {
        TicketStatus.OPEN: "Aberto",
        TicketStatus.IN_PROGRESS: "Em Andamento",
        TicketStatus.WAITING_STUDENT: "Aguardando Aluno",
        TicketStatus.RESOLVED: "Resolvido",
        TicketStatus.CLOSED: "Fechado",
    }
    
    statuses = [
        {"status": status_labels.get(st, st.value), "count": count}
        for st, count in by_status
    ]
    
    # Por dia (últimos 7 dias)
    daily_data = []
    for i in range(7, -1, -1):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        created = db.query(func.count(Ticket.id)).filter(
            Ticket.created_at >= day_start,
            Ticket.created_at < day_end
        ).scalar()
        
        closed = db.query(func.count(Ticket.id)).filter(
            Ticket.resolved_at >= day_start,
            Ticket.resolved_at < day_end
        ).scalar()
        
        daily_data.append({
            "date": day_start.strftime("%d/%m"),
            "created": created,
            "closed": closed,
        })
    
    return {
        "by_category": categories,
        "by_status": statuses,
        "daily": daily_data,
    }


@router.get("/engagement")
def get_engagement_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna métricas de engajamento do Moodle"""
    
    # Busca sinais mais recentes de cada aluno
    subquery = db.query(
        MoodleSignal.student_id,
        func.max(MoodleSignal.captured_at).label("latest")
    ).group_by(MoodleSignal.student_id).subquery()
    
    latest_signals = db.query(MoodleSignal).join(
        subquery,
        and_(
            MoodleSignal.student_id == subquery.c.student_id,
            MoodleSignal.captured_at == subquery.c.latest
        )
    ).all()
    
    if not latest_signals:
        return {
            "total_with_data": 0,
            "avg_progress": None,
            "avg_days_without_access": None,
            "access_distribution": [],
            "progress_distribution": [],
        }
    
    # Médias
    avg_progress = sum(s.progress_percent or 0 for s in latest_signals) / len(latest_signals)
    avg_days = sum(s.days_since_access or 0 for s in latest_signals) / len(latest_signals)
    
    # Distribuição de acesso
    access_dist = {"0-7 dias": 0, "8-14 dias": 0, "15-30 dias": 0, "30+ dias": 0}
    for s in latest_signals:
        days = s.days_since_access or 0
        if days <= 7:
            access_dist["0-7 dias"] += 1
        elif days <= 14:
            access_dist["8-14 dias"] += 1
        elif days <= 30:
            access_dist["15-30 dias"] += 1
        else:
            access_dist["30+ dias"] += 1
    
    # Distribuição de progresso
    progress_dist = {"0-25%": 0, "26-50%": 0, "51-75%": 0, "76-100%": 0}
    for s in latest_signals:
        prog = s.progress_percent or 0
        if prog <= 25:
            progress_dist["0-25%"] += 1
        elif prog <= 50:
            progress_dist["26-50%"] += 1
        elif prog <= 75:
            progress_dist["51-75%"] += 1
        else:
            progress_dist["76-100%"] += 1
    
    return {
        "total_with_data": len(latest_signals),
        "avg_progress": round(avg_progress, 1),
        "avg_days_without_access": round(avg_days, 1),
        "access_distribution": [{"label": k, "count": v} for k, v in access_dist.items()],
        "progress_distribution": [{"label": k, "count": v} for k, v in progress_dist.items()],
    }


@router.get("/satisfaction")
def get_satisfaction_metrics(
    days: int = Query(30, description="Período em dias"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna métricas de satisfação (NPS/CSAT)"""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # NPS
    nps_feedbacks = db.query(Feedback).filter(
        Feedback.feedback_type == FeedbackType.NPS,
        Feedback.answered_at >= cutoff,
        Feedback.score.isnot(None),
    ).all()
    
    nps_score = None
    if nps_feedbacks:
        promoters = sum(1 for f in nps_feedbacks if f.score >= 9)
        detractors = sum(1 for f in nps_feedbacks if f.score <= 6)
        nps_score = round(((promoters - detractors) / len(nps_feedbacks)) * 100, 1)
    
    # CSAT
    csat_feedbacks = db.query(Feedback).filter(
        Feedback.feedback_type == FeedbackType.CSAT,
        Feedback.answered_at >= cutoff,
        Feedback.score.isnot(None),
    ).all()
    
    csat_score = None
    if csat_feedbacks:
        satisfied = sum(1 for f in csat_feedbacks if f.score >= 4)
        csat_score = round((satisfied / len(csat_feedbacks)) * 100, 1)
    
    # Pendentes
    pending = db.query(func.count(Feedback.id)).filter(
        Feedback.answered_at.is_(None)
    ).scalar()
    
    return {
        "nps": {
            "score": nps_score,
            "responses": len(nps_feedbacks),
        },
        "csat": {
            "score": csat_score,
            "responses": len(csat_feedbacks),
        },
        "pending_responses": pending,
    }
