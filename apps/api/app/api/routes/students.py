from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.moodle_signal import MoodleSignal
from app.integrations import moodle

router = APIRouter(prefix="/students", tags=["students"])


@router.get("")
def list_students(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos os alunos"""
    students = db.query(Student).offset(skip).limit(limit).all()
    return students


@router.get("/{student_id}")
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca aluno por ID"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    return student


@router.post("/{student_id}/sync-moodle")
async def sync_student_moodle(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sincroniza dados do aluno com o Moodle"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    # Busca usuário no Moodle pelo email
    moodle_user = await moodle.get_user_by_email(student.email)
    
    if not moodle_user:
        raise HTTPException(status_code=404, detail="Aluno não encontrado no Moodle")
    
    # Atualiza moodle_user_id no student
    student.moodle_user_id = moodle_user["id"]
    
    # Busca cursos do aluno
    courses = await moodle.get_user_courses(moodle_user["id"])
    
    signals = []
    for course in courses:
        try:
            # Busca progresso
            completion = await moodle.get_course_completion(moodle_user["id"], course["id"])
            activities = completion.get("statuses", [])
            total = len(activities)
            completed = sum(1 for a in activities if a.get("state") == 1)
            progress = (completed / total * 100) if total > 0 else 0
            
            # Busca notas
            grades_data = await moodle.get_user_grades(moodle_user["id"], course["id"])
            grade_items = grades_data.get("usergrades", [{}])[0].get("gradeitems", [])
            course_grade = None
            for item in grade_items:
                if item.get("itemtype") == "course":
                    course_grade = item.get("graderaw")
                    break
            
            # Calcula dias sem acesso
            last_access = course.get("lastaccess")
            days_since = 0
            last_access_dt = None
            if last_access:
                last_access_dt = datetime.fromtimestamp(last_access)
                days_since = (datetime.utcnow() - last_access_dt).days
            
            # Cria ou atualiza sinal
            signal = db.query(MoodleSignal).filter(
                MoodleSignal.student_id == student.id,
                MoodleSignal.course_id == course["id"],
                MoodleSignal.captured_at == date.today()
            ).first()
            
            if not signal:
                signal = MoodleSignal(
                    student_id=student.id,
                    moodle_user_id=moodle_user["id"],
                    course_id=course["id"],
                    captured_at=date.today()
                )
                db.add(signal)
            
            signal.total_activities = total
            signal.completed_activities = completed
            signal.progress_percent = progress
            signal.course_grade = course_grade
            signal.last_access = last_access_dt
            signal.days_since_access = days_since
            
            signals.append({
                "course_id": course["id"],
                "course_name": course["fullname"],
                "progress": progress,
                "grade": course_grade,
                "days_since_access": days_since
            })
        except Exception as e:
            # Ignora erros em cursos individuais
            signals.append({
                "course_id": course["id"],
                "course_name": course.get("fullname", ""),
                "error": str(e)
            })
    
    db.commit()
    
    return {
        "student_id": student.id,
        "moodle_user_id": moodle_user["id"],
        "courses_synced": len(signals),
        "signals": signals
    }


@router.get("/{student_id}/moodle-signals")
def get_student_moodle_signals(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca sinais do Moodle do aluno"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    signals = db.query(MoodleSignal).filter(
        MoodleSignal.student_id == student_id
    ).order_by(MoodleSignal.captured_at.desc()).all()
    
    return {
        "student_id": student_id,
        "signals": [
            {
                "id": s.id,
                "course_id": s.course_id,
                "progress_percent": s.progress_percent,
                "course_grade": s.course_grade,
                "days_since_access": s.days_since_access,
                "captured_at": s.captured_at.isoformat() if s.captured_at else None
            }
            for s in signals
        ]
    }
