from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

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
    search: Optional[str] = Query(None),
    moodle_status: Optional[str] = Query(None),  # linked, unlinked
    login_status: Optional[str] = Query(None),  # logged, never_logged
    docs_status: Optional[str] = Query(None),  # complete, incomplete, none
    financial_status: Optional[str] = Query(None),  # em_dia, pendente, inadimplente
    risk_level: Optional[str] = Query(None),  # low, medium, high, critical
    risk_trend: Optional[str] = Query(None),  # improving, stable, worsening
    abandonment: Optional[str] = Query(None),  # active, at_risk, abandoned
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista alunos com filtros"""
    q = db.query(Student)
    
    # Busca por nome ou email
    if search:
        term = f"%{search}%"
        q = q.filter(or_(Student.name.ilike(term), Student.email.ilike(term)))
    
    # Filtro Moodle
    if moodle_status == "linked":
        q = q.filter(Student.moodle_user_id.isnot(None))
    elif moodle_status == "unlinked":
        q = q.filter(Student.moodle_user_id.is_(None))
    
    # Filtro Login
    if login_status == "never_logged":
        q = q.filter(
            Student.moodle_user_id.isnot(None),
            or_(Student.moodle_first_access.is_(None), Student.moodle_first_access == None)
        )
    elif login_status == "logged":
        q = q.filter(Student.moodle_first_access.isnot(None))
    
    # Filtro Documentos
    if docs_status == "complete":
        q = q.filter(Student.documents_count >= Student.documents_total)
    elif docs_status == "incomplete":
        q = q.filter(Student.documents_count > 0, Student.documents_count < Student.documents_total)
    elif docs_status == "none":
        q = q.filter(or_(Student.documents_count == 0, Student.documents_count.is_(None)))
    
    # Filtro Financeiro
    if financial_status:
        q = q.filter(Student.financial_status == financial_status)
    
    # Filtro Risco (usa risk_trend do model)
    if risk_trend:
        q = q.filter(Student.risk_trend == risk_trend)
    
    # Filtro Abandono
    if abandonment:
        q = q.filter(Student.abandonment_status == abandonment)
    
    # Filtro Curso
    if course_id:
        q = q.filter(Student.primary_course_id == course_id)
    
    total = q.count()
    students = q.order_by(Student.name).offset(skip).limit(limit).all()
    
    return {
        "data": [
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "phone": s.phone,
                "moodle_user_id": s.moodle_user_id,
                "moodle_first_access": s.moodle_first_access.isoformat() if s.moodle_first_access else None,
                "documents_count": s.documents_count or 0,
                "documents_total": s.documents_total or 5,
                "primary_course_id": s.primary_course_id,
                "primary_course_name": s.primary_course_name,
                "financial_status": s.financial_status,
                "abandonment_status": s.abandonment_status,
                "risk_trend": s.risk_trend,
            }
            for s in students
        ],
        "total": total,
        "page": (skip // limit) + 1,
        "per_page": limit,
        "total_pages": (total + limit - 1) // limit,
    }


@router.get("/courses")
def list_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista cursos distintos dos alunos"""
    courses = (
        db.query(Student.primary_course_id, Student.primary_course_name, func.count(Student.id))
        .filter(Student.primary_course_id.isnot(None))
        .group_by(Student.primary_course_id, Student.primary_course_name)
        .order_by(Student.primary_course_name)
        .all()
    )
    return [
        {"id": c[0], "name": c[1], "count": c[2]}
        for c in courses
    ]


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna estatísticas gerais dos alunos"""
    total = db.query(Student).count()
    linked = db.query(Student).filter(Student.moodle_user_id.isnot(None)).count()
    never_logged = db.query(Student).filter(
        Student.moodle_user_id.isnot(None),
        Student.moodle_first_access.is_(None)
    ).count()
    docs_complete = db.query(Student).filter(Student.documents_count >= Student.documents_total).count()
    docs_none = db.query(Student).filter(
        or_(Student.documents_count == 0, Student.documents_count.is_(None))
    ).count()
    inadimplente = db.query(Student).filter(Student.financial_status == "inadimplente").count()
    
    return {
        "total": total,
        "linked": linked,
        "unlinked": total - linked,
        "never_logged": never_logged,
        "documents": {
            "complete": docs_complete,
            "incomplete": total - docs_complete - docs_none,
            "none": docs_none,
        },
        "financial": {
            "inadimplente": inadimplente,
        },
    }


@router.get("/{student_id}")
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    moodle_user = await moodle.get_user_by_email(student.email)
    if not moodle_user:
        raise HTTPException(status_code=404, detail="Aluno não encontrado no Moodle")
    
    student.moodle_user_id = moodle_user["id"]
    
    # Atualiza firstaccess
    first_access_ts = moodle_user.get("firstaccess", 0)
    if first_access_ts and first_access_ts > 0:
        try:
            student.moodle_first_access = datetime.fromtimestamp(first_access_ts)
        except:
            pass
    
    courses = await moodle.get_user_courses(moodle_user["id"])
    
    signals = []
    for course in courses:
        try:
            completion = await moodle.get_course_completion(moodle_user["id"], course["id"])
            activities = completion.get("statuses", [])
            total = len(activities)
            completed = sum(1 for a in activities if a.get("state") == 1)
            progress = (completed / total * 100) if total > 0 else 0
            
            grades_data = await moodle.get_user_grades(moodle_user["id"], course["id"])
            grade_items = grades_data.get("usergrades", [{}])[0].get("gradeitems", [])
            course_grade = None
            for item in grade_items:
                if item.get("itemtype") == "course":
                    course_grade = item.get("graderaw")
                    break
            
            last_access = course.get("lastaccess")
            days_since = 0
            last_access_dt = None
            if last_access:
                last_access_dt = datetime.fromtimestamp(last_access)
                days_since = (datetime.utcnow() - last_access_dt).days
            
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


@router.post("/sync-all-moodle")
async def sync_all_students_moodle(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    students = db.query(Student).filter(
        Student.moodle_user_id.isnot(None)
    ).limit(limit).all()
    
    results = {"total": len(students), "synced": 0, "errors": 0}
    
    for student in students:
        try:
            courses = await moodle.get_user_courses(student.moodle_user_id)
            
            for course in courses:
                try:
                    completion = await moodle.get_course_completion(student.moodle_user_id, course["id"])
                    activities = completion.get("statuses", [])
                    total = len(activities)
                    completed = sum(1 for a in activities if a.get("state") == 1)
                    progress = (completed / total * 100) if total > 0 else 0
                    
                    grades_data = await moodle.get_user_grades(student.moodle_user_id, course["id"])
                    grade_items = grades_data.get("usergrades", [{}])[0].get("gradeitems", [])
                    course_grade = None
                    for item in grade_items:
                        if item.get("itemtype") == "course":
                            course_grade = item.get("graderaw")
                            break
                    
                    last_access = course.get("lastaccess")
                    days_since = 0
                    last_access_dt = None
                    if last_access:
                        last_access_dt = datetime.fromtimestamp(last_access)
                        days_since = (datetime.utcnow() - last_access_dt).days
                    
                    signal = db.query(MoodleSignal).filter(
                        MoodleSignal.student_id == student.id,
                        MoodleSignal.course_id == course["id"],
                        MoodleSignal.captured_at == date.today()
                    ).first()
                    
                    if not signal:
                        signal = MoodleSignal(
                            student_id=student.id,
                            moodle_user_id=student.moodle_user_id,
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
                    
                except Exception:
                    pass
            
            db.commit()
            results["synced"] += 1
            
        except Exception:
            results["errors"] += 1
    
    return results
