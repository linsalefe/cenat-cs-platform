from app.core.permissions import require_permission
from fastapi import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.core.permissions import require_permission
from app.models.user import User
from app.models.student import Student

from app.services import asaas_service

import calendar
from datetime import datetime, timedelta

router = APIRouter(prefix="/asaas", tags=["asaas"])


def _period_range(period: str, now: datetime) -> tuple[str, str]:
    """Retorna (start_date, end_date) no formato YYYY-MM-DD para o período.

    Função pura (testável). Critérios:
      - today: só o dia de hoje;
      - 7d / 30d: janela retroativa até hoje;
      - month: dia 1 até o ÚLTIMO dia do mês atual (mesmo critério do Asaas);
      - last_month: mês anterior inteiro (dia 1 ao último dia).
    """
    if period == "today":
        d = now.strftime("%Y-%m-%d")
        return d, d
    if period == "7d":
        return (now - timedelta(days=7)).strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d")
    if period == "30d":
        return (now - timedelta(days=30)).strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d")
    if period == "last_month":
        last_prev = now.replace(day=1) - timedelta(days=1)  # último dia do mês anterior
        start = f"{last_prev.year:04d}-{last_prev.month:02d}-01"
        end = f"{last_prev.year:04d}-{last_prev.month:02d}-{last_prev.day:02d}"
        return start, end
    # month (default): dia 1 até o último dia do mês atual
    last_day = calendar.monthrange(now.year, now.month)[1]
    start = f"{now.year:04d}-{now.month:02d}-01"
    end = f"{now.year:04d}-{now.month:02d}-{last_day:02d}"
    return start, end


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
    period: str = Query("month", description="today, 7d, 30d, month, last_month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("financial", "read")),
):
    """Resumo financeiro agregado com filtro de período.

    Todos os status (RECEIVED, CONFIRMED, PENDING, OVERDUE) filtram por
    vencimento dentro do intervalo (dueDate[ge]..dueDate[le]), mesmo critério
    que o Asaas usa — inclusive OVERDUE, que antes somava todo o histórico.
    """
    from sqlalchemy import func, case
    import pytz

    tz = pytz.timezone("America/Sao_Paulo")
    now = datetime.now(tz)

    start_date, end_date = _period_range(period, now)

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
                        # Vencimento dentro do intervalo pra TODOS os status (inclusive OVERDUE)
                        "dueDate[ge]": start_date,
                        "dueDate[le]": end_date,
                    }

                    r = await client.get(f"{base_url}/payments", headers=headers, params=params)
                    data = r.json()
                    items = data.get("data", [])
                    all_payments.extend(items)

                    if not data.get("hasMore", False):
                        break
                    offset += 100

                key = status.lower()
                payments_data[key] = all_payments

        def _agg(payments: list) -> dict:
            return {
                "count": len(payments),
                "value": sum(p.get("value", 0) or 0 for p in payments),
                "net_value": sum(p.get("netValue", 0) or 0 for p in payments),
                "customers": len({p.get("customer") for p in payments if p.get("customer")}),
            }

        payments_summary = {
            "received": _agg(payments_data["received"]),
            "confirmed": _agg(payments_data["confirmed"]),
            "pending": _agg(payments_data["pending"]),
            "overdue": _agg(payments_data["overdue"]),
        }

    except Exception as e:
        print(f"⚠️ Erro ao buscar totais ASAAS: {e}")
        _empty = {"count": 0, "value": 0, "net_value": 0, "customers": 0}
        payments_summary = {
            "received": dict(_empty),
            "confirmed": dict(_empty),
            "pending": dict(_empty),
            "overdue": dict(_empty),
        }

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
        "payments": payments_summary,
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
