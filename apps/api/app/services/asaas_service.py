import os
import httpx
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

ASAAS_API_KEY = os.getenv("ASAAS_API_KEY", "")
ASAAS_BASE_URL = os.getenv("ASAAS_BASE_URL", "https://api.asaas.com/v3")

HEADERS = {
    "access_token": ASAAS_API_KEY,
    "Content-Type": "application/json",
}


async def get_customer_by_email(email: str) -> Optional[dict]:
    """Busca cliente no ASAAS por email"""
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
    """Busca cliente no ASAAS por CPF"""
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
    """Lista todos os clientes do ASAAS com paginação"""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{ASAAS_BASE_URL}/customers",
            headers=HEADERS,
            params={"limit": limit, "offset": offset},
        )
        return r.json()


async def get_customer_payments(customer_id: str, status: Optional[str] = None) -> list:
    """Busca cobranças de um cliente. Status: PENDING, RECEIVED, OVERDUE, CONFIRMED, etc."""
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


def calculate_financial_status(payments: list) -> dict:
    """Calcula status financeiro baseado nas cobranças"""
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
