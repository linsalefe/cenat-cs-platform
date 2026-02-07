import asyncio
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.student import Student
from app.integrations import moodle


def format_phone(phone: str) -> str:
    if not phone:
        return ""
    numbers = "".join(c for c in phone if c.isdigit())
    if len(numbers) == 11:
        numbers = "55" + numbers
    elif len(numbers) == 10:
        numbers = "55" + numbers
    return numbers


async def sync_students_from_moodle_async():
    """Sincroniza todos os alunos ativos do Moodle com o banco local"""
    print("🔄 Iniciando sincronização de alunos do Moodle...")
    
    db = SessionLocal()
    
    try:
        moodle_students = await moodle.get_all_enrolled_students()
        print(f"📚 Encontrados {len(moodle_students)} alunos no Moodle")
        
        created = 0
        updated = 0
        
        for m_student in moodle_students:
            moodle_id = m_student["id"]
            email = m_student["email"].lower().strip()
            name = m_student["fullname"]
            phone = format_phone(m_student.get("phone", ""))
            
            # firstaccess
            first_access_ts = m_student.get("firstaccess", 0)
            first_access_dt = None
            if first_access_ts and first_access_ts > 0:
                try:
                    first_access_dt = datetime.fromtimestamp(first_access_ts)
                except:
                    pass
            
            # Documentos
            docs_count = m_student.get("documents_count", 0)
            docs_total = m_student.get("documents_total", 5)
            
            # Curso principal
            primary_course_id = m_student.get("primary_course_id")
            primary_course_name = m_student.get("primary_course_name")
            
            # Busca aluno existente
            student = db.query(Student).filter(
                (Student.moodle_user_id == moodle_id) | (Student.email == email)
            ).first()
            
            if student:
                student.moodle_user_id = moodle_id
                student.name = name
                if phone:
                    student.phone = phone
                student.moodle_first_access = first_access_dt
                student.documents_count = docs_count
                student.documents_total = docs_total
                student.primary_course_id = primary_course_id
                student.primary_course_name = primary_course_name
                updated += 1
            else:
                student = Student(
                    name=name,
                    email=email,
                    phone=phone,
                    moodle_user_id=moodle_id,
                    moodle_first_access=first_access_dt,
                    documents_count=docs_count,
                    documents_total=docs_total,
                    primary_course_id=primary_course_id,
                    primary_course_name=primary_course_name,
                )
                db.add(student)
                created += 1
        
        db.commit()
        
        print(f"✅ Sincronização concluída: {created} criados, {updated} atualizados")
        return {"created": created, "updated": updated, "total": len(moodle_students)}
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erro na sincronização: {e}")
        raise e
    finally:
        db.close()


def sync_students_from_moodle():
    """Wrapper síncrono para rodar no scheduler"""
    asyncio.run(sync_students_from_moodle_async())
