"""
Rota pública de formulário de onboarding.
Cria/atualiza aluno e dispara automações com trigger 'form_submitted'.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import copy

from app.core.deps import get_db
from app.models.student import Student
from app.models.automation import Automation, AutomationLog
from app.services.automation_service import execute_action
from app.integrations.whatsapp_meta import normalize_br_phone

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingForm(BaseModel):
    name: str
    email: EmailStr
    phone: str
    course: str


@router.get("/courses")
async def list_onboarding_courses():
    """Lista cursos disponíveis para o formulário (público)"""
    try:
        from app.services.moodle_courses import get_all_courses
        courses = await get_all_courses()
        return [c["fullname"] for c in courses if c.get("fullname")]
    except Exception:
        return []


@router.post("")
async def submit_onboarding(form: OnboardingForm, db: Session = Depends(get_db)):
    """Recebe formulário de onboarding e dispara automações"""

    phone_clean = normalize_br_phone(form.phone.replace("(", "").replace(")", "").replace("-", "").replace(" ", ""))

    # Verifica se aluno já existe (por email)
    student = db.query(Student).filter(Student.email == form.email).first()

    if student:
        student.name = form.name
        student.phone = phone_clean
    else:
        student = Student(
            name=form.name,
            email=form.email,
            phone=phone_clean,
        )
        db.add(student)

    db.commit()
    db.refresh(student)

    print(f"📋 Onboarding: {student.name} | {student.phone} | {form.course}")

    # Dispara automações com trigger 'form_submitted'
    automations = db.query(Automation).filter(
        Automation.trigger_type == "form_submitted",
        Automation.is_active == True,
    ).all()

    print(f"🔍 Automações encontradas: {len(automations)}")

    results = []
    for automation in automations:
        try:
            # Cria cópia do config pra não modificar o objeto do banco
            config_copy = copy.deepcopy(automation.action_config or {})
            config_copy["_course_override"] = form.course
            automation.action_config = config_copy

            print(f"⚡ Executando: {automation.name} | Config: {automation.action_config}")

            result = await execute_action(automation, student, db)

            print(f"✅ Resultado: {result}")

            # Registra log da execução
            log = AutomationLog(
                automation_id=automation.id,
                student_id=student.id,
                student_name=student.name,
                action_type=automation.action_type,
                status=result.get("status", "success"),
                details=result,
            )
            db.add(log)
            db.commit()

            results.append({
                "automation": automation.name,
                "result": result,
            })
        except Exception as e:
            print(f"❌ Erro: {e}")
            import traceback
            traceback.print_exc()
            results.append({
                "automation": automation.name,
                "error": str(e),
            })

    return {
        "status": "success",
        "message": f"Cadastro realizado! Bem-vindo(a), {form.name}!",
        "student_id": student.id,
        "automations_triggered": len(results),
        "results": results,
    }
