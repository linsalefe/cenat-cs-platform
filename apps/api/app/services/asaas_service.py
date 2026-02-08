import os
import httpx
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

ASAAS_API_KEY = os.getenv("ASAAS_API_KEY", "")
ASAAS_BASE_URL = os.getenv("ASAAS_BASE_URL", "https://api.asaas.com/v3")
HEADERS = {
    "access_token": ASAAS_API_KEY,
    "Content-Type": "application/json",
}


async def get_customer_by_email(email: str) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{ASAAS_BASE_URL}/customers",
            headers=HEADERS,
            params={"email": email},
        )
        data = r.json()
        if data.get("data") and len(data["data"]) > 0:
            return data["data"][0]
    return None


async def get_customer_by_cpf(cpf: str) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{ASAAS_BASE_URL}/customers",
            headers=HEADERS,
            params={"cpfCnpj": cpf},
        )
        data = r.json()
        if data.get("data") and len(data["data"]) > 0:
            return data["data"][0]
    return None


async def get_all_customers(limit: int = 100, offset: int = 0) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{ASAAS_BASE_URL}/customers",
            headers=HEADERS,
            params={"limit": limit, "offset": offset},
        )
        return r.json()


async def get_customer_payments(customer_id: str, status: Optional[str] = None) -> list:
    """Busca cobranças de um cliente específico"""
    payments = []
    offset = 0
    limit = 100
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            params = {"customer": customer_id, "limit": limit, "offset": offset}
            if status:
                params["status"] = status
            r = await client.get(
                f"{ASAAS_BASE_URL}/payments",
                headers=HEADERS,
                params=params,
            )
            data = r.json()
            payments.extend(data.get("data", []))
            if not data.get("hasMore", False):
                break
            offset += limit
    return payments


async def get_all_payments_by_status(status: str) -> list:
    """Busca TODAS as cobranças de um status específico (paginado)"""
    payments = []
    offset = 0
    limit = 100
    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            params = {"status": status, "limit": limit, "offset": offset}
            r = await client.get(
                f"{ASAAS_BASE_URL}/payments",
                headers=HEADERS,
                params=params,
            )
            data = r.json()
            batch = data.get("data", [])
            payments.extend(batch)
            print(f"   📥 {status}: {len(payments)} cobranças (offset {offset})")
            if not data.get("hasMore", False):
                break
            offset += limit
    return payments


async def sync_all_financial() -> dict:
    """
    Sync otimizado: busca todas as cobranças OVERDUE e PENDING de uma vez,
    depois mapeia para os alunos por customer_id.
    """
    print(f"💰 API Key: {ASAAS_API_KEY[:20]}... (len: {len(ASAAS_API_KEY)})")
    print(f"💰 Base URL: {ASAAS_BASE_URL}")

    # Teste direto antes de buscar
    async with httpx.AsyncClient(timeout=30) as test_client:
        test_r = await test_client.get(
            f"{ASAAS_BASE_URL}/payments",
            headers=HEADERS,
            params={"status": "OVERDUE", "limit": 1},
        )
        print(f"💰 Teste direto: status={test_r.status_code}, body={test_r.text[:200]}")

    print("💰 Buscando cobranças OVERDUE...")
    overdue_payments = await get_all_payments_by_status("OVERDUE")

    print("💰 Buscando cobranças PENDING...")
    pending_payments = await get_all_payments_by_status("PENDING")

    # Agrupa por customer_id
    customer_data = {}

    for p in overdue_payments:
        cid = p.get("customer")
        if not cid:
            continue
        if cid not in customer_data:
            customer_data[cid] = {"overdue_count": 0, "overdue_value": 0, "pending_count": 0, "pending_value": 0}
        customer_data[cid]["overdue_count"] += 1
        customer_data[cid]["overdue_value"] += float(p.get("value", 0))

    for p in pending_payments:
        cid = p.get("customer")
        if not cid:
            continue
        if cid not in customer_data:
            customer_data[cid] = {"overdue_count": 0, "overdue_value": 0, "pending_count": 0, "pending_value": 0}
        customer_data[cid]["pending_count"] += 1
        customer_data[cid]["pending_value"] += float(p.get("value", 0))

    return {
        "customer_data": customer_data,
        "total_overdue": len(overdue_payments),
        "total_pending": len(pending_payments),
        "total_overdue_value": sum(float(p.get("value", 0)) for p in overdue_payments),
        "total_pending_value": sum(float(p.get("value", 0)) for p in pending_payments),
    }


def calculate_financial_status(payments: list) -> dict:
    """Calcula status financeiro baseado nas cobranças (para uso individual)"""
    total = len(payments)
    overdue = [p for p in payments if p["status"] == "OVERDUE"]
    pending = [p for p in payments if p["status"] == "PENDING"]
    received = [p for p in payments if p["status"] in ("RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH")]

    overdue_value = sum(float(p["value"]) for p in overdue)
    pending_value = sum(float(p["value"]) for p in pending)
    received_value = sum(float(p["value"]) for p in received)

    if len(overdue) > 0:
        status = "inadimplente"
    elif len(pending) > 0:
        status = "pendente"
    else:
        status = "em_dia"

    return {
        "status": status,
        "total_payments": total,
        "overdue_count": len(overdue),
        "overdue_value": overdue_value,
        "pending_count": len(pending),
        "pending_value": pending_value,
        "received_count": len(received),
        "received_value": received_value,
    }