import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.risk_score import RiskScore, RiskLevel
from app.services.risk_service import calculate_student_risk

router = APIRouter(prefix="/risk", tags=["risk"])


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
    
    return {
        "student_id": student.id,
        "student_name": student.name,
        "score": round(risk_score.score, 2),
        "level": risk_score.level.value,
        "components": {
            "engagement": round(risk_score.engagement_score, 2),
            "progress": round(risk_score.progress_score, 2),
            "grade": round(risk_score.grade_score, 2),
            "financial": round(risk_score.financial_score, 2),
            "ticket": round(risk_score.ticket_score, 2),
        },
        "factors": json.loads(risk_score.factors) if risk_score.factors else [],
        "calculated_at": risk_score.calculated_at.isoformat(),
    }


@router.get("/students/at-risk")
def list_at_risk_students(
    level: RiskLevel | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista alunos em risco"""
    query = db.query(RiskScore).join(Student)
    
    if level:
        query = query.filter(RiskScore.level == level)
    else:
        # Por padrão, mostra apenas HIGH e CRITICAL
        query = query.filter(RiskScore.level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL]))
    
    risk_scores = query.order_by(RiskScore.score.desc()).all()
    
    return [
        {
            "student_id": rs.student_id,
            "student_name": rs.student.name,
            "student_email": rs.student.email,
            "score": round(rs.score, 2),
            "level": rs.level.value,
            "factors": json.loads(rs.factors) if rs.factors else [],
            "calculated_at": rs.calculated_at.isoformat(),
        }
        for rs in risk_scores
    ]


@router.get("/students/{student_id}")
def get_student_risk(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca score de risco de um aluno"""
    risk_score = db.query(RiskScore).filter(
        RiskScore.student_id == student_id
    ).first()
    
    if not risk_score:
        raise HTTPException(status_code=404, detail="Score não encontrado. Execute o cálculo primeiro.")
    
    return {
        "student_id": risk_score.student_id,
        "student_name": risk_score.student.name,
        "score": round(risk_score.score, 2),
        "level": risk_score.level.value,
        "components": {
            "engagement": round(risk_score.engagement_score, 2),
            "progress": round(risk_score.progress_score, 2),
            "grade": round(risk_score.grade_score, 2),
            "financial": round(risk_score.financial_score, 2),
            "ticket": round(risk_score.ticket_score, 2),
        },
        "factors": json.loads(risk_score.factors) if risk_score.factors else [],
        "calculated_at": risk_score.calculated_at.isoformat(),
    }


@router.post("/calculate-all")
def calculate_all_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recalcula score de todos os alunos"""
    students = db.query(Student).all()
    
    results = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
    
    for student in students:
        risk_score = calculate_student_risk(db, student)
        results["total"] += 1
        results[risk_score.level.value] += 1
    
    return results


@router.get("/summary")
def get_risk_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna resumo dos scores de risco"""
    from sqlalchemy import func
    
    summary = db.query(
        RiskScore.level,
        func.count(RiskScore.id).label("count")
    ).group_by(RiskScore.level).all()
    
    result = {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0}
    
    for level, count in summary:
        result[level.value] = count
        result["total"] += count
    
    return result
