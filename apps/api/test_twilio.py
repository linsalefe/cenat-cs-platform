import asyncio
from dotenv import load_dotenv
load_dotenv()

from app.integrations.twilio_service import send_message

async def main():
    resultado = await send_message("5583988046720", "Teste de integração Twilio - WhatsApp 🚀")
    print(resultado)

asyncio.run(main())
