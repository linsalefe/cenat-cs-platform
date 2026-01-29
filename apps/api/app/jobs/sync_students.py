import asyncio
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.student import Student
from app.integrations import moodle


def format_phone(phone: str) -> str:
    """Formata telefone removendo caracteres especiais"""
    if not phone:
        return ""
    # Remove tudo que não é número
    numbers = "".join(c for c in phone if c.isdigit())
    # Se não tem código do país, assume Brasil
    if len(numbers) == 11:  # DDD + 9 dígitos
        numbers = "55" + numbers
    elif len(numbers) == 10:  # DDD + 8 dígitos (fixo)
        numbers = "55" + numbers
    return numbers


async def sync_students_from_moodle_async():
    """Sincroniza todos os alunos ativos do Moodle com o banco local"""
    print("🔄 Iniciando sincronização de alunos do Moodle...")
    
    db = SessionLocal()
    
    try:
        # Busca todos os alunos matriculados no Moodle
        moodle_students = await moodle.get_all_enrolled_students()
        print(f"📚 Encontrados {len(moodle_students)} alunos no Moodle")
        
        created = 0
        updated = 0
        
        for m_student in moodle_students:
            moodle_id = m_student["id"]
            email = m_student["email"].lower().strip()
            name = m_student["fullname"]
            phone = format_phone(m_student.get("phone", ""))
            
            # Busca aluno existente por moodle_user_id ou email
            student = db.query(Student).filter(
                (Student.moodle_user_id == moodle_id) | (Student.email == email)
            ).first()
            
            if student:
                # Atualiza dados
                student.moodle_user_id = moodle_id
                student.name = name
                if phone and not student.phone:
                    student.phone = phone
                elif phone and student.phone != phone:
                    # Só atualiza se o telefone do Moodle estiver preenchido
                    student.phone = phone
                updated += 1
            else:
                # Cria novo aluno
                student = Student(
                    name=name,
                    email=email,
                    phone=phone,
                    moodle_user_id=moodle_id,
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
