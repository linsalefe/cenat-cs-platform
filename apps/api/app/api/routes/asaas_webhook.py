import os
from datetime import datetime
from fastapi import APIRouter, Request, Header
from fastapi.responses import Response
from typing import Optional

from app.core.deps import get_db
from app.models.student import Student
from app.services import asaas_service

ASAAS_WEBHOOK_TOKEN = os.getenv("ASAAS_WEBHOOK_TOKEN", "")

router = APIRouter(prefix="/webhook", tags=["webhooks"])

# Eventos que nos interessam para atualizar status financeiro
FINANCIAL_EVENTS = {
    "PAYMENT_CREATED",
    "PAYMENT_UPDATED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE",
    "PAYMENT_DELETED",
    "PAYMENT_RESTORED",
    "PAYMENT_REFUNDED",
}


@router.post("/asaas")
async def asaas_webhook(
    request: Request,
    asaas_access_token: Optional[str] = Header(None),
):
    """Recebe eventos do ASAAS em tempo real"""

    # Valida token se configurado
    if ASAAS_WEBHOOK_TOKEN and asaas_access_token != ASAAS_WEBHOOK_TOKEN:
        print(f"⚠️ ASAAS webhook: token inválido")
        return Response(status_code=200)  # Retorna 200 pra não pausar a fila

    try:
        body = await request.json()
    except Exception:
        return Response(status_code=200)

    event = body.get("event", "")
    payment = body.get("payment", {})

    if not payment:
        return Response(status_code=200)

    customer_id = payment.get("customer", "")
    payment_id = payment.get("id", "")
    payment_status = payment.get("status", "")
    payment_value = payment.get("value", 0)

    print(f"💰 ASAAS Webhook: {event} | Payment: {payment_id} | Customer: {customer_id} | Status: {payment_status} | Valor: R${payment_value}")

    # Só processa eventos financeiros relevantes
    if event not in FINANCIAL_EVENTS:
        print(f"   ↳ Evento ignorado: {event}")
        return Response(status_code=200)

    if not customer_id:
        print(f"   ↳ Sem customer_id, ignorando")
        return Response(status_code=200)

    db = next(get_db())

    try:
        # Encontra o aluno pelo asaas_customer_id
        student = db.query(Student).filter(
            Student.asaas_customer_id == customer_id
        ).first()

        if not student:
            print(f"   ↳ Aluno não encontrado para customer: {customer_id}")
            return Response(status_code=200)

        print(f"   ↳ Aluno encontrado: {student.name} (ID: {student.id})")

        # Recalcula status financeiro com TODAS as cobranças do aluno
        payments = await asaas_service.get_customer_payments(customer_id)
        result = asaas_service.calculate_financial_status(payments)

        old_status = student.financial_status
        student.financial_status = result["status"]
        student.overdue_value = result["overdue_value"]
        db.commit()

        print(f"   ✅ Status atualizado: {old_status} → {result['status']} | Atraso: R${result['overdue_value']:.2f}")

        # Log de mudança de status
        if old_status != result["status"]:
            print(f"   🔔 MUDANÇA DE STATUS: {student.name} | {old_status} → {result['status']}")

            # Aqui podemos disparar automações futuras
            # Ex: aluno pagou (inadimplente → em_dia) → WhatsApp de agradecimento
            # Ex: aluno atrasou (em_dia → inadimplente) → WhatsApp de lembrete

    except Exception as e:
        db.rollback()
        print(f"   ❌ Erro ao processar webhook ASAAS: {e}")
    finally:
        db.close()

    return Response(status_code=200)
