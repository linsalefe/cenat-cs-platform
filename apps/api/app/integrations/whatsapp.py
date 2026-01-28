import os
import httpx

EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://localhost:8080")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "cenat")


async def send_message(phone: str, message: str) -> dict:
    """Envia mensagem via Evolution API"""
    url = f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}"
    
    # Formata número para padrão brasileiro
    phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    if not phone_clean.startswith("55"):
        phone_clean = f"55{phone_clean}"
    
    payload = {
        "number": phone_clean,
        "text": message
    }
    
    headers = {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        return response.json()


def format_phone(phone: str) -> str:
    """Remove formatação do telefone"""
    return phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
