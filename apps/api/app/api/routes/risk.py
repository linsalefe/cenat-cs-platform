import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.risk_score import RiskScore, RiskLevel
from app.models.risk_history import RiskHistory
from app.services.risk_service import calculate_student_risk

router = APIRouter(prefix="/risk", tags=["risk"])


def build_student_risk_response(student: Student, rs: RiskScore) -> dict:
    """Helper pra montar resposta padrão com tendência"""
    return {
        "student_id": student.id,
        "student_name": student.name,
        "student_email": student.email,
        "student_phone": student.phone,
        "score": round(rs.score, 2),
        "level": rs.level.value,
        "trend": rs.trend or "stable",
        "trend_delta": round(rs.trend_delta or 0, 2),
        "trends": {
            "attendance": rs.attendance_trend or "stable",
            "financial": rs.financial_trend or "stable",
            "engagement": rs.engagement_trend or "stable",
        },
        "components": {
            "engagement": round(rs.engagement_score, 2),
            "attendance": round(rs.progress_score, 2),
            "grade": round(rs.grade_score, 2),
            "financial": round(rs.financial_score, 2),
            "ticket": round(rs.ticket_score, 2),
            "nps": round(rs.nps_score, 2),
        },
        "attendance_info": {
            "total": student.attendance_total or 0,
            "absences": student.attendance_absences or 0,
            "consecutive_absences": student.attendance_consecutive_absences or 0,
            "rate": round((student.attendance_absences or 0) / max(student.attendance_total or 1, 1) * 100, 1),
        },
        "abandonment_status": student.abandonment_status,
        "factors": json.loads(rs.factors) if rs.factors else [],
        "calculated_at": rs.calculated_at.isoformat(),
    }


@router.post("/students/{student_id}/calculate")
def calculate_risk(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calcula o score de risco de um aluno"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    risk_score = calculate_student_risk(db, student)
    return build_student_risk_response(student, risk_score)


@router.get("/students/at-risk")
def get_students_at_risk(
    level: str = Query(None, description="Filtrar por nível: critical, high, medium, low"),
    trend: str = Query(None, description="Filtrar por tendência: worsening, stable, improving"),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista alunos em risco com paginação e filtro de tendência"""
    query = db.query(RiskScore).join(Student)
    
    if level:
        try:
            risk_level = RiskLevel(level)
            query = query.filter(RiskScore.level == risk_level)
        except ValueError:
            pass
    else:
        query = query.filter(RiskScore.level.in_([RiskLevel.CRITICAL, RiskLevel.HIGH]))
    
    if trend:
        query = query.filter(RiskScore.trend == trend)
    
    total = query.count()
    total_pages = (total + per_page - 1) // per_page
    
    offset = (page - 1) * per_page
    risk_scores = query.order_by(RiskScore.score.desc()).offset(offset).limit(per_page).all()
    
    students = []
    for rs in risk_scores:
        student = db.query(Student).filter(Student.id == rs.student_id).first()
        if student:
            students.append(build_student_risk_response(student, rs))
    
    return {
        "data": students,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
        }
    }


@router.get("/students/{student_id}")
def get_student_risk(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca score de risco de um aluno com tendência"""
    risk_score = db.query(RiskScore).filter(RiskScore.student_id == student_id).first()
    if not risk_score:
        raise HTTPException(status_code=404, detail="Score não encontrado. Execute o cálculo primeiro.")
    
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    return build_student_risk_response(student, risk_score)


@router.get("/students/{student_id}/history")
def get_student_risk_history(
    student_id: int,
    weeks: int = Query(12, ge=1, le=52, description="Semanas de histórico"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna histórico semanal do score de risco de um aluno"""
    history = db.query(RiskHistory).filter(
        RiskHistory.student_id == student_id,
    ).order_by(RiskHistory.period_end.asc()).limit(weeks).all()

    return {
        "student_id": student_id,
        "weeks": len(history),
        "history": [
            {
                "period_start": h.period_start.isoformat(),
                "period_end": h.period_end.isoformat(),
                "score": round(h.score, 2),
                "components": {
                    "engagement": round(h.engagement_score, 2),
                    "attendance": round(h.attendance_score, 2),
                    "academic": round(h.academic_score, 2),
                    "financial": round(h.financial_score, 2),
                    "ticket": round(h.ticket_score, 2),
                    "nps": round(h.nps_score, 2),
                }
            }
            for h in history
        ],
    }


@router.post("/calculate-all")
def calculate_all_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recalcula o score de todos os alunos"""
    students = db.query(Student).all()
    
    results = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0, "worsening": 0, "improving": 0}
    
    for student in students:
        try:
            risk_score = calculate_student_risk(db, student)
            results["total"] += 1
            results[risk_score.level.value] += 1
            if risk_score.trend == "worsening":
                results["worsening"] += 1
            elif risk_score.trend == "improving":
                results["improving"] += 1
        except Exception as e:
            print(f"Erro ao calcular risco do aluno {student.id}: {e}")
    
    return results


@router.get("/summary")
def get_risk_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna resumo com distribuição de risco e tendências"""
    # Contagem por nível
    level_counts = db.query(
        RiskScore.level, func.count(RiskScore.id)
    ).group_by(RiskScore.level).all()
    
    # Contagem por tendência
    trend_counts = db.query(
        RiskScore.trend, func.count(RiskScore.id)
    ).group_by(RiskScore.trend).all()

    # Abandonos
    abandoned = db.query(Student).filter(Student.abandonment_status == "abandoned").count()
    at_risk = db.query(Student).filter(Student.abandonment_status == "at_risk").count()

    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0}
    for level, count in level_counts:
        summary[level.value] = count
        summary["total"] += count
    
    trends = {"worsening": 0, "stable": 0, "improving": 0}
    for trend, count in trend_counts:
        if trend in trends:
            trends[trend] = count

    return {
        **summary,
        "trends": trends,
        "abandonment": {
            "abandoned": abandoned,
            "at_risk": at_risk,
        }
    }
