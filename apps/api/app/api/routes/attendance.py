from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student
from app.jobs.sync_attendance import sync_attendance_data

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/sync")
async def sync_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sincroniza presenças do Moodle e detecta abandonos"""
    stats = await sync_attendance_data(db)
    return {"status": "ok", **stats}


@router.get("/abandoned")
async def get_abandoned_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista alunos detectados como abandono"""
    students = db.query(Student).filter(
        Student.abandonment_status == "abandoned"
    ).all()

    return {
        "total": len(students),
        "students": [
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "financial_status": s.financial_status,
                "overdue_value": s.overdue_value or 0,
                "attendance_absences": s.attendance_absences or 0,
                "attendance_total": s.attendance_total or 0,
                "attendance_consecutive_absences": s.attendance_consecutive_absences or 0,
            }
            for s in students
        ],
    }


@router.get("/at-risk")
async def get_at_risk_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista alunos em risco de abandono (inadimplente OU 8+ faltas)"""
    students = db.query(Student).filter(
        Student.abandonment_status == "at_risk"
    ).all()

    return {
        "total": len(students),
        "students": [
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "financial_status": s.financial_status,
                "overdue_value": s.overdue_value or 0,
                "attendance_absences": s.attendance_absences or 0,
                "attendance_total": s.attendance_total or 0,
                "attendance_consecutive_absences": s.attendance_consecutive_absences or 0,
            }
            for s in students
        ],
    }
