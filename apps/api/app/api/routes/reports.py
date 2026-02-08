from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from typing import Optional

from app.core.deps import get_current_user, get_db
from app.models.student import Student
from app.models.broadcast import Broadcast, BroadcastLog
from app.models.journey import JourneyRule, StudentJourney
from app.models.risk_score import RiskScore
from app.models.ticket import Ticket
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/executive")
def executive_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard executivo — visão geral para diretoria"""

    # === ALUNOS ===
    total_students = db.query(Student).count()
    with_phone = db.query(Student).filter(Student.phone.isnot(None), Student.phone != "").count()
    with_moodle = db.query(Student).filter(Student.moodle_user_id.isnot(None)).count()

    # === FINANCEIRO ===
    financial = db.query(
        Student.financial_status,
        func.count(Student.id)
    ).filter(
        Student.financial_status.isnot(None)
    ).group_by(Student.financial_status).all()

    financial_map = {status: count for status, count in financial}
    total_em_dia = financial_map.get("em_dia", 0)
    total_pendente = financial_map.get("pendente", 0)
    total_inadimplente = financial_map.get("inadimplente", 0)
    total_com_financeiro = total_em_dia + total_pendente + total_inadimplente

    overdue_total = db.query(func.sum(Student.overdue_value)).filter(
        Student.overdue_value > 0
    ).scalar() or 0

    # === RISCO ===
    risk_scores = db.query(
        RiskScore.level,
        func.count(RiskScore.id)
    ).group_by(RiskScore.level).all()

    risk_map = {str(level): count for level, count in risk_scores}

    # === POR CURSO ===
    courses = db.query(
        Student.primary_course_name,
        func.count(Student.id).label("total"),
        func.sum(case((Student.financial_status == "inadimplente", 1), else_=0)).label("inadimplentes"),
        func.sum(case((Student.financial_status == "em_dia", 1), else_=0)).label("em_dia"),
        func.sum(case((Student.financial_status == "pendente", 1), else_=0)).label("pendentes"),
        func.avg(Student.overdue_value).label("avg_overdue"),
    ).filter(
        Student.primary_course_name.isnot(None)
    ).group_by(
        Student.primary_course_name
    ).order_by(
        func.count(Student.id).desc()
    ).all()

    courses_data = []
    for c in courses:
        courses_data.append({
            "course": c[0] if c[0] else "Sem curso",
            "total": c[1],
            "inadimplentes": int(c[2] or 0),
            "em_dia": int(c[3] or 0),
            "pendentes": int(c[4] or 0),
            "avg_overdue": round(float(c[5] or 0), 2),
        })

    # === DOCUMENTAÇÃO ===
    docs_complete = db.query(Student).filter(
        Student.documents_count >= Student.documents_total,
        Student.documents_total > 0
    ).count()
    docs_incomplete = db.query(Student).filter(
        Student.documents_count > 0,
        Student.documents_count < Student.documents_total
    ).count()
    docs_none = db.query(Student).filter(
        Student.documents_count == 0
    ).count()

    # === ACESSO MOODLE ===
    moodle_accessed = db.query(Student).filter(
        Student.moodle_first_access.isnot(None)
    ).count()
    moodle_never = db.query(Student).filter(
        Student.moodle_user_id.isnot(None),
        Student.moodle_first_access.is_(None)
    ).count()

    # === DISPAROS ===
    total_broadcasts = db.query(Broadcast).count()
    total_messages_sent = db.query(func.sum(Broadcast.sent_count)).scalar() or 0
    total_messages_failed = db.query(func.sum(Broadcast.failed_count)).scalar() or 0

    # === RÉGUAS ===
    total_journeys = db.query(JourneyRule).count()
    active_journeys = db.query(JourneyRule).filter(JourneyRule.is_active == True).count()
    students_in_journey = db.query(StudentJourney).filter(StudentJourney.status == "active").count()

    # === TICKETS ===
    total_tickets = db.query(Ticket).count()

    return {
        "summary": {
            "total_students": total_students,
            "with_phone": with_phone,
            "with_moodle": with_moodle,
            "phone_coverage": round(with_phone / total_students * 100, 1) if total_students else 0,
        },
        "financial": {
            "em_dia": total_em_dia,
            "pendente": total_pendente,
            "inadimplente": total_inadimplente,
            "total": total_com_financeiro,
            "overdue_total": round(float(overdue_total), 2),
            "health_rate": round(total_em_dia / total_com_financeiro * 100, 1) if total_com_financeiro else 0,
        },
        "risk": risk_map,
        "documents": {
            "complete": docs_complete,
            "incomplete": docs_incomplete,
            "none": docs_none,
        },
        "moodle": {
            "accessed": moodle_accessed,
            "never_accessed": moodle_never,
        },
        "broadcasts": {
            "total": total_broadcasts,
            "messages_sent": int(total_messages_sent),
            "messages_failed": int(total_messages_failed),
        },
        "journeys": {
            "total": total_journeys,
            "active": active_journeys,
            "students_active": students_in_journey,
        },
        "tickets": {
            "total": total_tickets,
        },
        "courses": courses_data,
    }
