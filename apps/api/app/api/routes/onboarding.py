"""
Rotas de onboarding:
- Formulário público (POST /onboarding)
- Kanban interno (GET/PATCH/POST com auth)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import copy

from app.core.deps import get_db, get_current_user
from app.models.student import Student
from app.models.automation import Automation, AutomationLog
from app.services.automation_service import execute_action
from app.integrations.whatsapp_meta import normalize_br_phone

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

VALID_STATUSES = [
    "novo", "boas_vindas_enviada", "docs_pendentes",
    "docs_ok", "acesso_moodle", "concluido"
]


# ──────────────────────────────────────
# ROTAS PÚBLICAS (formulário)
# ──────────────────────────────────────

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
    phone_clean = normalize_br_phone(
        form.phone.replace("(", "").replace(")", "").replace("-", "").replace(" ", "")
    )

    student = db.query(Student).filter(Student.email == form.email).first()

    if student:
        student.name = form.name
        student.phone = phone_clean
    else:
        student = Student(
            name=form.name,
            email=form.email,
            phone=phone_clean,
            onboarding_status="novo",
        )
        db.add(student)

    db.commit()
    db.refresh(student)

    print(f"📋 Onboarding: {student.name} | {student.phone} | {form.course}")

    automations = db.query(Automation).filter(
        Automation.trigger_type == "form_submitted",
        Automation.is_active == True,
    ).all()

    print(f"🔍 Automações encontradas: {len(automations)}")

    results = []
    for automation in automations:
        try:
            config_copy = copy.deepcopy(automation.action_config or {})
            config_copy["_course_override"] = form.course
            automation.action_config = config_copy

            result = await execute_action(automation, student, db)

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

            results.append({"automation": automation.name, "result": result})
        except Exception as e:
            print(f"❌ Erro: {e}")
            import traceback
            traceback.print_exc()
            results.append({"automation": automation.name, "error": str(e)})

    return {
        "status": "success",
        "message": f"Cadastro realizado! Bem-vindo(a), {form.name}!",
        "student_id": student.id,
        "automations_triggered": len(results),
        "results": results,
    }


# ──────────────────────────────────────
# ROTAS INTERNAS (Kanban — requer auth)
# ──────────────────────────────────────

@router.get("/students")
def list_onboarding_students(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lista alunos agrupados por status de onboarding"""
    students = db.query(Student).filter(
        Student.onboarding_status.in_(VALID_STATUSES)
    ).order_by(Student.created_at.desc()).all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "phone": s.phone,
            "primary_course_name": s.primary_course_name,
            "onboarding_status": s.onboarding_status or "novo",
            "moodle_first_access": s.moodle_first_access.isoformat() if s.moodle_first_access else None,
            "documents_count": s.documents_count or 0,
            "documents_total": s.documents_total or 5,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in students
    ]


@router.patch("/students/{student_id}/status")
def update_onboarding_status(
    student_id: int,
    status: str = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Altera status do onboarding (drag-and-drop)"""
    if status not in VALID_STATUSES:
        raise HTTPException(400, f"Status inválido. Use: {VALID_STATUSES}")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Aluno não encontrado")

    student.onboarding_status = status
    db.commit()
    return {"ok": True}


@router.post("/students/{student_id}/welcome")
async def send_welcome(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Envia template de boas-vindas e move para 'boas_vindas_enviada'"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    if not student.phone:
        raise HTTPException(400, "Aluno sem telefone cadastrado")

    from app.integrations.whatsapp_meta import send_template
    result = await send_template(
        phone=student.phone,
        template_name="boas_vindas",
        language="pt_BR",
        components=[{
            "type": "body",
            "parameters": [
                {"type": "text", "text": student.name.split()[0] if student.name else ""},
                {"type": "text", "text": student.primary_course_name or "sua pós-graduação no CENAT"},
            ]
        }],
        channel_slug="cs",
    )

    if result.get("status") == "sent":
        student.onboarding_status = "boas_vindas_enviada"
        db.commit()

    return result