from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student

from app.services import asaas_service

router = APIRouter(prefix="/asaas", tags=["asaas"])


@router.post("/sync-customers")
async def sync_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cruza clientes do ASAAS com alunos por email, atualiza CPF, telefone e asaas_customer_id"""
    offset = 0
    limit = 100
    matched = 0
    not_found = 0
    total_asaas = 0

    while True:
        data = await asaas_service.get_all_customers(limit=limit, offset=offset)
        customers = data.get("data", [])
        total_asaas += len(customers)

        for customer in customers:
            email = (customer.get("email") or "").lower().strip()
            if not email:
                not_found += 1
                continue

            student = db.query(Student).filter(Student.email == email).first()
            if student:
                student.asaas_customer_id = customer["id"]
                student.cpf = customer.get("cpfCnpj")
                phone = customer.get("mobilePhone") or customer.get("phone")
                if phone and not student.phone:
                    student.phone = phone
                matched += 1
            else:
                not_found += 1

        if not data.get("hasMore", False):
            break
        offset += limit

    db.commit()

    return {
        "status": "ok",
        "total_asaas": total_asaas,
        "matched": matched,
        "not_found": not_found,
    }


@router.post("/sync-financial")
async def sync_financial(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza status financeiro de todos os alunos vinculados ao ASAAS"""
    students = db.query(Student).filter(Student.asaas_customer_id != None).all()

    updated = 0
    errors = 0

    for student in students:
        try:
            payments = await asaas_service.get_customer_payments(student.asaas_customer_id)
            result = asaas_service.calculate_financial_status(payments)
            student.financial_status = result["status"]
            student.overdue_value = result["overdue_value"]
            updated += 1
        except Exception as e:
            print(f"Erro ao processar {student.name}: {e}")
            errors += 1

    db.commit()

    return {
        "status": "ok",
        "updated": updated,
        "errors": errors,
    }


@router.get("/student/{student_id}/payments")
async def get_student_payments(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna cobranças de um aluno específico"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    if not student.asaas_customer_id:
        return {"payments": [], "financial": None, "message": "Aluno não vinculado ao ASAAS"}

    payments = await asaas_service.get_customer_payments(student.asaas_customer_id)
    financial = asaas_service.calculate_financial_status(payments)

    return {
        "payments": payments,
        "financial": financial,
    }
