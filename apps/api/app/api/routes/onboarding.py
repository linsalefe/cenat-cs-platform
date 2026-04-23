"""
Rotas de onboarding:
- Formulário público (POST /onboarding)
- Criar aluno manualmente no Kanban (POST /onboarding/students)
- Kanban interno (GET/PATCH com auth)

B.3+: dispara evento "onboarding_entered" quando aluno entra com status "novo"
(via formulário OU criação manual).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional
import copy

from app.core.deps import get_db, get_current_user
from app.models.student import Student
from app.models.automation import Automation, AutomationLog
from app.models.onboarding_form_field import OnboardingFormField
from app.services.automation_service import execute_action
from app.integrations.whatsapp_meta import normalize_br_phone

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

# Conjunto unificado — alinhado com node-definitions.ts (workflows)
VALID_STATUSES = [
    "novo",
    "em_contato",
    "em_andamento",
    "aguardando_doc",
    "follow_up",
    "concluido",
]


def _validate_and_normalize_custom_fields(
    db,
    raw: dict | None,
) -> tuple[dict, list[str]]:
    """Valida custom_fields contra a definição ativa em OnboardingFormField.

    Retorna (valores_normalizados, erros). Campos não listados no schema
    são ignorados silenciosamente (não quebra).
    """
    from app.models.onboarding_form_field import OnboardingFormField

    raw = raw or {}
    errors: list[str] = []

    active_fields = (
        db.query(OnboardingFormField)
        .filter(OnboardingFormField.active == True)  # noqa: E712
        .all()
    )
    by_key = {f.key: f for f in active_fields}

    normalized: dict = {}

    for key, spec in by_key.items():
        value = raw.get(key)
        if value is None or (isinstance(value, str) and not value.strip()):
            if spec.required:
                errors.append(f"Campo '{spec.label}' é obrigatório")
            continue

        if spec.type == "text":
            normalized[key] = str(value).strip()[:2000]
        elif spec.type == "select":
            opts = spec.options or []
            if str(value) not in opts:
                errors.append(
                    f"Valor inválido para '{spec.label}' "
                    f"(esperado: {opts})"
                )
                continue
            normalized[key] = str(value)
        else:
            # Tipo desconhecido — ignora
            continue

    return normalized, errors


def _dispatch_onboarding_entered(db: Session, student: Student) -> None:
    """Fire-and-forget: dispara trigger.onboarding_entered via workflow_dispatcher.
    Nunca quebra o fluxo de criação do aluno."""
    try:
        from app.services import workflow_dispatcher

        workflow_dispatcher.dispatch(
            db=db,
            event_type="onboarding_entered",
            student=student,
            context={"onboarding_status": student.onboarding_status or "novo"},
        )
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️ Falha ao despachar onboarding_entered: {exc}")


# ──────────────────────────────────────
# ROTAS PÚBLICAS (formulário)
# ──────────────────────────────────────

class OnboardingForm(BaseModel):
    name: str
    email: EmailStr
    phone: str
    course: str
    custom_fields: Optional[dict] = None


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
    """Recebe formulário de onboarding e dispara automações."""
    phone_clean = normalize_br_phone(
        form.phone.replace("(", "").replace(")", "").replace("-", "").replace(" ", "")
    )

    # Validar custom_fields contra schema ativo
    custom_values, field_errors = _validate_and_normalize_custom_fields(
        db, form.custom_fields
    )
    if field_errors:
        raise HTTPException(400, {"custom_fields_errors": field_errors})

    student = db.query(Student).filter(Student.email == form.email).first()
    is_new = student is None

    if student:
        student.name = form.name
        student.phone = phone_clean
        # Merge: preserva valores antigos não re-enviados
        merged = dict(student.custom_fields or {})
        merged.update(custom_values)
        student.custom_fields = merged
    else:
        student = Student(
            name=form.name,
            email=form.email,
            phone=phone_clean,
            onboarding_status="novo",
            primary_course_name=form.course,
            custom_fields=custom_values or {},
        )
        db.add(student)

    db.commit()
    db.refresh(student)

    print(f"📋 Onboarding: {student.name} | {student.phone} | {form.course}")

    # Dispara workflows (trigger.onboarding_entered) — só para alunos novos
    if is_new:
        _dispatch_onboarding_entered(db, student)

    # Mantém automações legacy (system antigo de Automation)
    automations = db.query(Automation).filter(
        Automation.trigger_type == "form_submitted",
        Automation.is_active == True,  # noqa: E712
    ).all()

    print(f"🔍 Automações legacy encontradas: {len(automations)}")

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

class ManualOnboardingCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    course: Optional[str] = None
    status: Optional[str] = "novo"  # qualquer um de VALID_STATUSES
    custom_fields: Optional[dict] = None


@router.post("/students")
def create_onboarding_student(
    data: ManualOnboardingCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Cria um aluno manualmente no Kanban (sem passar pelo formulário público).

    Se email já existe, retorna 409.
    Dispara trigger.onboarding_entered se criado com status "novo".
    """
    status = data.status or "novo"
    if status not in VALID_STATUSES:
        raise HTTPException(
            400,
            f"Status inválido. Use um de: {', '.join(VALID_STATUSES)}",
        )

    phone_clean = normalize_br_phone(
        data.phone.replace("(", "").replace(")", "").replace("-", "").replace(" ", "")
    )

    existing = db.query(Student).filter(Student.email == data.email).first()
    if existing:
        raise HTTPException(
            409,
            f"Já existe aluno com este email (id {existing.id}, status: {existing.onboarding_status or '-'}).",
        )

    custom_values, field_errors = _validate_and_normalize_custom_fields(
        db, data.custom_fields
    )
    if field_errors:
        raise HTTPException(400, {"custom_fields_errors": field_errors})

    student = Student(
        name=data.name,
        email=data.email,
        phone=phone_clean,
        onboarding_status=status,
        primary_course_name=data.course,
        custom_fields=custom_values or {},
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # Só dispara o trigger se caiu em "novo" (onboarding começando)
    if status == "novo":
        _dispatch_onboarding_entered(db, student)

    return {
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "phone": student.phone,
        "primary_course_name": student.primary_course_name,
        "onboarding_status": student.onboarding_status,
        "custom_fields": student.custom_fields or {},
        "created_at": student.created_at.isoformat() if student.created_at else None,
    }


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
            "custom_fields": s.custom_fields or {},
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

    previous = student.onboarding_status
    student.onboarding_status = status
    db.commit()

    # Se voltou / caiu em "novo", redispara (ex: reativar onboarding)
    if status == "novo" and previous != "novo":
        _dispatch_onboarding_entered(db, student)

    return {"ok": True}


@router.post("/students/{student_id}/welcome")
async def send_welcome(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Envia template de boas-vindas e move para 'em_contato'"""
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
        student.onboarding_status = "em_contato"
        db.commit()

    return result
