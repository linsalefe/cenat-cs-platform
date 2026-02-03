from datetime import datetime
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.student import Student
from app.models.moodle_signal import MoodleSignal
from app.integrations import moodle


async def sync_moodle_signals():
    """Captura sinais do Moodle para todos os alunos vinculados"""
    print("🔄 Iniciando captura de sinais do Moodle...")
    
    db = SessionLocal()
    
    try:
        students = db.query(Student).filter(
            Student.moodle_user_id != None
        ).all()
        
        print(f"📚 {len(students)} alunos com vínculo Moodle")
        
        created = 0
        errors = 0
        today = datetime.utcnow().date()
        
        for i, student in enumerate(students):
            try:
                # Busca cursos do aluno
                courses = await moodle.get_user_courses(student.moodle_user_id)
                
                if not courses:
                    continue
                
                for course in courses:
                    course_id = course["id"]
                    
                    # Pula cursos do sistema (id=1 geralmente é o site)
                    if course_id == 1:
                        continue
                    
                    # Verifica se já capturou hoje para esse curso
                    existing = db.query(MoodleSignal).filter(
                        MoodleSignal.student_id == student.id,
                        MoodleSignal.course_id == course_id,
                        MoodleSignal.captured_at == today,
                    ).first()
                    
                    if existing:
                        continue
                    
                    # Busca completion
                    total_activities = 0
                    completed_activities = 0
                    progress_percent = 0.0
                    
                    try:
                        completion = await moodle.get_course_completion(
                            student.moodle_user_id, course_id
                        )
                        statuses = completion.get("statuses", [])
                        if statuses:
                            total_activities = len(statuses)
                            completed_activities = sum(
                                1 for s in statuses if s.get("complete")
                            )
                            progress_percent = (
                                (completed_activities / total_activities * 100)
                                if total_activities > 0
                                else 0
                            )
                    except Exception:
                        pass
                    
                    # Busca notas
                    course_grade = None
                    try:
                        grades = await moodle.get_user_grades(
                            student.moodle_user_id, course_id
                        )
                        items = grades.get("usergrades", [{}])
                        if items:
                            grade_items = items[0].get("gradeitems", [])
                            # Pega a nota do curso (último item geralmente é o total)
                            for item in grade_items:
                                if item.get("itemtype") == "course":
                                    raw = item.get("graderaw")
                                    if raw is not None:
                                        course_grade = float(raw)
                    except Exception:
                        pass
                    
                    # Calcula dias sem acesso
                    last_access = None
                    days_since = 0
                    last_access_ts = course.get("lastaccess", 0)
                    if last_access_ts and last_access_ts > 0:
                        last_access = datetime.fromtimestamp(last_access_ts)
                        days_since = (datetime.utcnow() - last_access).days
                    
                    # Cria sinal
                    signal = MoodleSignal(
                        student_id=student.id,
                        moodle_user_id=student.moodle_user_id,
                        course_id=course_id,
                        total_activities=total_activities,
                        completed_activities=completed_activities,
                        progress_percent=progress_percent,
                        course_grade=course_grade,
                        last_access=last_access,
                        days_since_access=days_since,
                        captured_at=today,
                    )
                    db.add(signal)
                    created += 1
                
                # Commit a cada 50 alunos
                if (i + 1) % 50 == 0:
                    db.commit()
                    print(f"  ⏳ {i + 1}/{len(students)} alunos processados ({created} sinais)")
                    
            except Exception as e:
                errors += 1
                if errors <= 5:
                    print(f"  ❌ Erro {student.name}: {e}")
                db.rollback()
        
        db.commit()
        print(f"✅ Captura concluída: {created} sinais criados, {errors} erros")
        return {"created": created, "errors": errors}
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erro geral: {e}")
        raise
    finally:
        db.close()
