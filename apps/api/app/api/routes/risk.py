import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

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
            "nps": round(risk_score.nps_score, 2),
        },
        "factors": json.loads(risk_score.factors) if risk_score.factors else [],
        "calculated_at": risk_score.calculated_at.isoformat(),
    }


@router.get("/students/at-risk")
def get_students_at_risk(
    level: str = Query(None, description="Filtrar por nível: critical, high, medium, low"),
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(30, ge=1, le=100, description="Itens por página"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista alunos em risco com paginação"""
    query = db.query(RiskScore).join(Student)
    
    if level:
        try:
            risk_level = RiskLevel(level)
            query = query.filter(RiskScore.level == risk_level)
        except ValueError:
            pass
    else:
        # Por padrão, mostra critical e high
        query = query.filter(RiskScore.level.in_([RiskLevel.CRITICAL, RiskLevel.HIGH]))
    
    # Total para paginação
    total = query.count()
    total_pages = (total + per_page - 1) // per_page
    
    # Ordenar por score descendente e aplicar paginação
    offset = (page - 1) * per_page
    risk_scores = query.order_by(RiskScore.score.desc()).offset(offset).limit(per_page).all()
    
    students = []
    for rs in risk_scores:
        student = db.query(Student).filter(Student.id == rs.student_id).first()
        if student:
            students.append({
                "student_id": student.id,
                "student_name": student.name,
                "student_email": student.email,
                "student_phone": student.phone,
                "score": round(rs.score, 2),
                "level": rs.level.value,
                "factors": json.loads(rs.factors) if rs.factors else [],
                "calculated_at": rs.calculated_at.isoformat(),
            })
    
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
    """Busca score de risco de um aluno"""
    risk_score = db.query(RiskScore).filter(RiskScore.student_id == student_id).first()
    
    if not risk_score:
        raise HTTPException(status_code=404, detail="Score não encontrado. Execute o cálculo primeiro.")
    
    student = db.query(Student).filter(Student.id == student_id).first()
    
    return {
        "student_id": student_id,
        "student_name": student.name if student else None,
        "score": round(risk_score.score, 2),
        "level": risk_score.level.value,
        "components": {
            "engagement": round(risk_score.engagement_score, 2),
            "progress": round(risk_score.progress_score, 2),
            "grade": round(risk_score.grade_score, 2),
            "financial": round(risk_score.financial_score, 2),
            "ticket": round(risk_score.ticket_score, 2),
            "nps": round(risk_score.nps_score, 2),
        },
        "factors": json.loads(risk_score.factors) if risk_score.factors else [],
        "calculated_at": risk_score.calculated_at.isoformat(),
    }


@router.post("/calculate-all")
def calculate_all_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recalcula o score de todos os alunos"""
    students = db.query(Student).all()
    
    results = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
    
    for student in students:
        try:
            risk_score = calculate_student_risk(db, student)
            results["total"] += 1
            results[risk_score.level.value] += 1
        except Exception as e:
            print(f"Erro ao calcular risco do aluno {student.id}: {e}")
    
    return results


@router.get("/summary")
def get_risk_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna resumo da distribuição de risco"""
    counts = db.query(
        RiskScore.level,
        func.count(RiskScore.id)
    ).group_by(RiskScore.level).all()
    
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0}
    
    for level, count in counts:
        summary[level.value] = count
        summary["total"] += count
    
    return summary
