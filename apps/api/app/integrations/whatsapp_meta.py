import os
import httpx
from dotenv import load_dotenv

load_dotenv()

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
GRAPH_API_URL = "https://graph.facebook.com/v22.0"


def format_phone(phone: str) -> str:
    """Remove formatação e adiciona prefixo BR"""
    phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    if not phone_clean.startswith("55"):
        phone_clean = f"55{phone_clean}"
    return phone_clean


async def send_message(phone: str, message: str) -> dict:
    """Envia mensagem de texto via Meta Cloud API"""
    phone_clean = format_phone(phone)

    url = f"{GRAPH_API_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_clean,
        "type": "text",
        "text": {"body": message},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=payload, headers=headers)
        data = r.json()

        if r.status_code == 200 and "messages" in data:
            return {
                "status": "sent",
                "message_id": data["messages"][0]["id"],
                "to": phone_clean,
            }
        else:
            return {
                "status": "error",
                "error": data.get("error", {}).get("message", str(data)),
                "to": phone_clean,
            }


async def send_template(phone: str, template_name: str, language: str = "pt_BR", components: list = None) -> dict:
    """Envia mensagem de template aprovado pela Meta"""
    phone_clean = format_phone(phone)

    url = f"{GRAPH_API_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_clean,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language},
        },
    }

    if components:
        payload["template"]["components"] = components

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=payload, headers=headers)
        data = r.json()

        if r.status_code == 200 and "messages" in data:
            return {
                "status": "sent",
                "message_id": data["messages"][0]["id"],
                "to": phone_clean,
            }
        else:
            return {
                "status": "error",
                "error": data.get("error", {}).get("message", str(data)),
                "to": phone_clean,
            }


async def mark_as_read(message_id: str) -> dict:
    """Marca mensagem como lida"""
    url = f"{GRAPH_API_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=payload, headers=headers)
        return r.json()
