from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student
from app.jobs.sync_attendance import sync_attendance_data

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/sync")
async def sync_attendance(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispara a sincronização de presenças em background (sem timeout).

    Ao final, recalcula o risco dos alunos que tiveram presença atualizada.
    """
    background_tasks.add_task(run_attendance_sync)
    return {
        "status": "processing",
        "message": "Sincronização de presenças iniciada em background. Atualize em alguns minutos.",
    }


async def run_attendance_sync():
    """Executa o sync de presenças em background e recalcula o risco dos alunos atualizados."""
    from app.db.session import SessionLocal
    from app.services.risk_service import calculate_student_risk

    print("📋 Iniciando sync de presenças em background...")
    db = SessionLocal()
    try:
        stats = await sync_attendance_data(db)
        student_ids = stats.get("student_ids", [])
        recalculated = 0
        for sid in student_ids:
            student = db.query(Student).filter(Student.id == sid).first()
            if not student:
                continue
            try:
                calculate_student_risk(db, student)
                recalculated += 1
            except Exception as e:
                print(f"❌ Erro ao recalcular risco do aluno {sid}: {e}")
        print(f"✅ Sync de presenças concluído. Risco recalculado para {recalculated} aluno(s).")
    except Exception as e:
        print(f"❌ Erro no sync de presenças: {e}")
    finally:
        db.close()


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
