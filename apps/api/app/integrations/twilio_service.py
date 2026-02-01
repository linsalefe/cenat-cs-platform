import os
from twilio.rest import Client

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")  # Sandbox

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def format_phone(phone: str) -> str:
    """Remove formatação do telefone e adiciona prefixo BR"""
    phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    if not phone_clean.startswith("55"):
        phone_clean = f"55{phone_clean}"
    return f"+{phone_clean}"


async def send_message(phone: str, message: str) -> dict:
    """Envia mensagem WhatsApp via Twilio (mesma interface do whatsapp.py)"""
    to_number = f"whatsapp:{format_phone(phone)}"

    try:
        msg = client.messages.create(
            body=message,
            from_=TWILIO_WHATSAPP_FROM,
            to=to_number,
        )
        return {
            "status": msg.status,
            "sid": msg.sid,
            "to": to_number,
            "error_code": msg.error_code,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "to": to_number,
        }