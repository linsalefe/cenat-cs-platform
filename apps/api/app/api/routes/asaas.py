from app.core.permissions import require_permission
from fastapi import APIRouter, Depends, BackgroundTasks, Query
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

@router.get("/summary")
async def financial_summary(
    period: str = Query("month", description="today, 7d, 30d, month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("financial", "read")),
):
    """Resumo financeiro agregado com filtro de período"""
    from sqlalchemy import func, case
    from datetime import datetime, timedelta
    import pytz

    tz = pytz.timezone("America/Sao_Paulo")
    now = datetime.now(tz)

    # Define intervalo de datas
    if period == "today":
        start_date = now.strftime("%Y-%m-%d")
        end_date = start_date
    elif period == "7d":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")
    elif period == "30d":
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")
    else:  # month
        start_date = now.strftime("%Y-%m-01")
        end_date = now.strftime("%Y-%m-%d")

    # Dados dos alunos (sem filtro de data — é snapshot)
    result = db.query(
        func.count(case((Student.financial_status == 'em_dia', 1))).label('em_dia_count'),
        func.count(case((Student.financial_status == 'pendente', 1))).label('pendente_count'),
        func.count(case((Student.financial_status == 'inadimplente', 1))).label('inadimplente_count'),
        func.count(case((Student.financial_status.is_(None), 1))).label('sem_vinculo_count'),
        func.coalesce(func.sum(case((Student.financial_status == 'inadimplente', Student.overdue_value), else_=0)), 0).label('total_overdue'),
    ).first()

    # Busca cobranças da API ASAAS com filtro de data
    try:
        import httpx, os
        api_key = os.getenv("ASAAS_API_KEY", "")
        base_url = os.getenv("ASAAS_BASE_URL", "https://api.asaas.com/v3")
        headers = {"access_token": api_key}

        async with httpx.AsyncClient(timeout=30) as client:
            payments_data = {"received": [], "confirmed": [], "pending": [], "overdue": []}

            for status in ["RECEIVED", "CONFIRMED", "PENDING", "OVERDUE"]:
                offset = 0
                all_payments = []
                while True:
                    params = {
                        "status": status,
                        "limit": 100,
                        "offset": offset,
                    }
                    if status in ["RECEIVED", "CONFIRMED", "PENDING"]:
                        params["dueDate[ge]"] = start_date
                        params["dueDate[le]"] = end_date
                    elif status == "OVERDUE":
                        # Vencidas: todas até hoje
                        params["dueDate[le]"] = end_date

                    r = await client.get(f"{base_url}/payments", headers=headers, params=params)
                    data = r.json()
                    items = data.get("data", [])
                    all_payments.extend(items)

                    if not data.get("hasMore", False):
                        break
                    offset += 100

                key = status.lower()
                payments_data[key] = all_payments

        received_value = sum(p.get("value", 0) for p in payments_data["received"])
        confirmed_value = sum(p.get("value", 0) for p in payments_data["confirmed"])
        pending_value = sum(p.get("value", 0) for p in payments_data["pending"])
        overdue_value = sum(p.get("value", 0) for p in payments_data["overdue"])

        received_count = len(payments_data["received"])
        confirmed_count = len(payments_data["confirmed"])
        pending_count = len(payments_data["pending"])
        overdue_count = len(payments_data["overdue"])

    except Exception as e:
        print(f"⚠️ Erro ao buscar totais ASAAS: {e}")
        received_value = confirmed_value = pending_value = overdue_value = 0
        received_count = confirmed_count = pending_count = overdue_count = 0

    return {
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "students": {
            "em_dia": result.em_dia_count,
            "pendente": result.pendente_count,
            "inadimplente": result.inadimplente_count,
            "sem_vinculo": result.sem_vinculo_count,
            "total_overdue": float(result.total_overdue),
        },
        "payments": {
            "received": {"count": received_count, "value": received_value},
            "confirmed": {"count": confirmed_count, "value": confirmed_value},
            "pending": {"count": pending_count, "value": pending_value},
            "overdue": {"count": overdue_count, "value": overdue_value},
        },
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
