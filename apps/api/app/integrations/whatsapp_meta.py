import httpx
from app.core.whatsapp_channels import WhatsAppChannel, get_channel, DEFAULT_CHANNEL

GRAPH_API_URL = "https://graph.facebook.com/v22.0"


def format_phone(phone: str) -> str:
    """Remove formatação e adiciona prefixo BR"""
    phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    if not phone_clean.startswith("55"):
        phone_clean = f"55{phone_clean}"
    return phone_clean


def _get_channel(channel_slug: str | None = None) -> WhatsAppChannel:
    """Resolve o canal a usar"""
    slug = channel_slug or DEFAULT_CHANNEL
    channel = get_channel(slug)
    if not channel or not channel.is_configured:
        raise ValueError(f"Canal '{slug}' não configurado")
    return channel


def _register_outbound(phone: str, content: str, message_id: str = None):
    """Registra mensagem enviada na conversa (fire and forget)"""
    try:
        from app.core.deps import get_db
        from app.services.conversation_service import add_outbound_message_by_phone

        db = next(get_db())
        try:
            add_outbound_message_by_phone(
                db=db,
                phone=phone,
                content=content,
                message_sid=message_id,
            )
        finally:
            db.close()
    except Exception as e:
        print(f"⚠️ Erro ao registrar mensagem na conversa: {e}")


async def send_message(phone: str, message: str, channel_slug: str | None = None) -> dict:
    """Envia mensagem de texto via Meta Cloud API"""
    channel = _get_channel(channel_slug)
    phone_clean = format_phone(phone)

    url = f"{GRAPH_API_URL}/{channel.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {channel.token}",
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
            msg_id = data["messages"][0]["id"]
            _register_outbound(phone_clean, message, msg_id)
            return {
                "status": "sent",
                "message_id": msg_id,
                "to": phone_clean,
                "channel": channel.slug,
            }
        else:
            return {
                "status": "error",
                "error": data.get("error", {}).get("message", str(data)),
                "to": phone_clean,
                "channel": channel.slug,
            }


async def send_template(phone: str, template_name: str, language: str = "pt_BR", components: list = None, channel_slug: str | None = None, register: bool = True) -> dict:
    """Envia mensagem de template aprovado pela Meta"""
    channel = _get_channel(channel_slug)
    phone_clean = format_phone(phone)

    url = f"{GRAPH_API_URL}/{channel.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {channel.token}",
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
            msg_id = data["messages"][0]["id"]
            # Monta preview do template pra registrar na conversa
            preview = f"[Template: {template_name}]"
            if components:
                params = []
                for comp in components:
                    for param in comp.get("parameters", []):
                        if param.get("type") == "text":
                            params.append(param["text"])
                if params:
                    preview = f"[Template: {template_name}] ({', '.join(params)})"
            if register:
                _register_outbound(phone_clean, preview, msg_id)
            return {
                "status": "sent",
                "message_id": msg_id,
                "to": phone_clean,
                "channel": channel.slug,
            }
        else:
            return {
                "status": "error",
                "error": data.get("error", {}).get("message", str(data)),
                "to": phone_clean,
                "channel": channel.slug,
            }


async def mark_as_read(message_id: str, channel_slug: str | None = None) -> dict:
    """Marca mensagem como lida"""
    channel = _get_channel(channel_slug)

    url = f"{GRAPH_API_URL}/{channel.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {channel.token}",
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


def normalize_br_phone(phone: str) -> str:
    """Normaliza número BR recebido da Meta.
    A Meta às vezes envia celulares sem o 9:
    558388046720 -> 5583988046720
    """
    phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "")

    if not phone_clean.startswith("55"):
        return phone_clean

    # Remove o 55
    local = phone_clean[2:]

    # DDD (2 dígitos) + número
    if len(local) == 10:
        # Celular sem o 9 (DDD + 8 dígitos começando com [6-9])
        ddd = local[:2]
        number = local[2:]
        if number[0] in "6789":
            return f"55{ddd}9{number}"

    return phone_clean


async def upload_media(file_bytes: bytes, mime_type: str, filename: str, channel_slug: str | None = None) -> str:
    """Faz upload de mídia para a Meta e retorna o media_id."""
    channel = _get_channel(channel_slug)
    url = f"{GRAPH_API_URL}/{channel.phone_number_id}/media"
    headers = {"Authorization": f"Bearer {channel.token}"}
    files = {
        "file": (filename, file_bytes, mime_type),
        "messaging_product": (None, "whatsapp"),
        "type": (None, mime_type),
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, files=files)
        data = r.json()
    media_id = data.get("id")
    if not media_id:
        raise ValueError(f"Falha no upload de mídia: {data}")
    return media_id


async def send_media_message(phone: str, media_id: str, media_type: str, channel_slug: str | None = None, caption: str = None, filename: str = None) -> dict:
    """Envia mensagem de mídia (image/audio/video/document) via Meta Cloud API.
    NÃO registra no banco — quem chama é responsável por salvar a mensagem."""
    channel = _get_channel(channel_slug)
    phone_clean = format_phone(phone)
    url = f"{GRAPH_API_URL}/{channel.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {channel.token}",
        "Content-Type": "application/json",
    }
    media_obj = {"id": media_id}
    if caption and media_type in ("image", "video", "document"):
        media_obj["caption"] = caption
    if filename and media_type == "document":
        media_obj["filename"] = filename
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_clean,
        "type": media_type,
        media_type: media_obj,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=payload, headers=headers)
        data = r.json()
    if r.status_code == 200 and "messages" in data:
        return {"status": "sent", "message_id": data["messages"][0]["id"], "to": phone_clean, "channel": channel.slug}
    return {"status": "error", "error": data.get("error", {}).get("message", str(data)), "to": phone_clean, "channel": channel.slug}
