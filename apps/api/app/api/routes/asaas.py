from app.core.permissions import require_permission
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.core.permissions import require_permission
from app.models.user import User
from app.models.student import Student

from app.services import asaas_service

router = APIRouter(prefix="/asaas", tags=["asaas"])


@router.post("/sync-customers")
async def sync_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("financial", "read")),
):
    """Cruza clientes do ASAAS com alunos por email, atualiza CPF, telefone e asaas_customer_id"""
    offset = 0
    limit = 100
    matched = 0
    not_found = 0
    total_asaas = 0
    errors = 0

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
                try:
                    student.asaas_customer_id = customer["id"]
                    phone = customer.get("mobilePhone") or customer.get("phone")
                    if phone and not student.phone:
                        student.phone = phone
                    # CPF: só atualiza se não causar conflito
                    cpf = customer.get("cpfCnpj")
                    if cpf:
                        existing = db.query(Student).filter(
                            Student.cpf == cpf, Student.id != student.id
                        ).first()
                        if not existing:
                            student.cpf = cpf
                    db.commit()
                    matched += 1
                except Exception as e:
                    db.rollback()
                    errors += 1
                    print(f"⚠️ Erro ao atualizar {email}: {e}")
            else:
                not_found += 1

        if not data.get("hasMore", False):
            break
        offset += limit

    return {
        "status": "ok",
        "total_asaas": total_asaas,
        "matched": matched,
        "not_found": not_found,
        "errors": errors,
    }


@router.post("/sync-financial")
async def sync_financial(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("financial", "read")),
):
    """Inicia sync financeiro em background"""
    background_tasks.add_task(run_financial_sync)
    return {"status": "processing", "message": "Sincronização iniciada em background. Aguarde alguns minutos e atualize a página."}


async def run_financial_sync():
    """Executa sync financeiro em background"""
    from app.db.session import SessionLocal
    print("💰 Iniciando sync financeiro...")

    try:
        result = await asaas_service.sync_all_financial()
        customer_data = result["customer_data"]

        db = SessionLocal()
        try:
            students = db.query(Student).filter(Student.asaas_customer_id != None).all()
            inadimplentes = 0
            pendentes = 0
            em_dia = 0

            for student in students:
                cid = student.asaas_customer_id
                data = customer_data.get(cid)

                if data and data["overdue_count"] > 0:
                    student.financial_status = "inadimplente"
                    student.overdue_value = data["overdue_value"]
                    inadimplentes += 1
                elif data and data["pending_count"] > 0:
                    student.financial_status = "pendente"
                    student.overdue_value = 0
                    pendentes += 1
                else:
                    student.financial_status = "em_dia"
                    student.overdue_value = 0
                    em_dia += 1

            db.commit()
            print(f"✅ Sync financeiro concluído: {inadimplentes} inadimplentes, {pendentes} pendentes, {em_dia} em dia")
            print(f"   💸 Total vencido: R$ {result['total_overdue_value']:.2f} ({result['total_overdue']} cobranças)")
            print(f"   ⏳ Total pendente: R$ {result['total_pending_value']:.2f} ({result['total_pending']} cobranças)")
        finally:
            db.close()
    except Exception as e:
        print(f"❌ Erro no sync financeiro: {e}")


@router.get("/student/{student_id}/payments")
async def get_student_payments(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("financial", "read")),
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
