import os
import shutil
import subprocess
import tempfile
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.deps import get_db, get_current_user
from app.core.whatsapp_channels import get_channel
from app.integrations.whatsapp_meta import GRAPH_API_URL
from app.services import conversation_service
from app.models.conversation import Conversation, ConversationMessage, ConversationStatus, MessageSenderType

router = APIRouter(prefix="/conversations", tags=["conversations"])


class SendMessageRequest(BaseModel):
    content: str


class AssignRequest(BaseModel):
    user_id: Optional[int] = None


class TagsRequest(BaseModel):
    tags: list[str] = []


class NotesRequest(BaseModel):
    notes: str = ""


class StatusRequest(BaseModel):
    status: str


class TemplateMessageRequest(BaseModel):
    template_name: str
    language: str = "pt_BR"
    params: list[str] = []
    rendered_text: str = ""


# ========================
# SERIALIZAÇÃO
# ========================

def serialize_conversation(conv: Conversation) -> dict:
    """Converte ORM Conversation para dict serializável"""
    return {
        "id": conv.id,
        "contact_phone": conv.contact_phone,
        "contact_name": conv.contact_name,
        "channel": conv.channel,
        "student_id": conv.student_id,
        "assigned_to_id": conv.assigned_to_id,
        "assigned_to": {
            "id": conv.assigned_to.id,
            "name": conv.assigned_to.name,
        } if conv.assigned_to else None,
        "status": conv.status.value if hasattr(conv.status, "value") else conv.status,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "last_message_preview": conv.last_message_preview,
        "unread_count": conv.unread_count or 0,
        "tags": conv.tags or [],
        "notes": conv.notes or "",
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
    }


def serialize_message(msg) -> dict:
    """Converte ORM ConversationMessage para dict serializável"""
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "direction": msg.direction.value if hasattr(msg.direction, "value") else msg.direction,
        "sender_type": msg.sender_type.value if hasattr(msg.sender_type, "value") else msg.sender_type,
        "sender_user_id": msg.sender_user_id,
        "content": msg.content,
        "message_type": getattr(msg, "message_type", "text") or "text",
        "message_sid": msg.message_sid,
        "status": msg.status,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# ========================
# ROTAS
# ========================

@router.get("")
def list_conversations(
    status: Optional[str] = None,
    channel: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lista todas as conversas — filtrado por canal do usuário"""
    # Admin e Gestor veem tudo, Atendente/Visualizador só veem seu canal
    if not channel and current_user.role in ("atendente", "visualizador"):
        channel = getattr(current_user, "channel", None)

    conversations = conversation_service.list_conversations(db, status, assigned_to_id, unread_only, channel=channel)
    return [serialize_conversation(c) for c in conversations]


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retorna detalhes de uma conversa"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return serialize_conversation(conversation)


@router.get("/{conversation_id}/messages")
def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retorna mensagens de uma conversa"""
    messages = conversation_service.get_conversation_messages(db, conversation_id)
    return [serialize_message(m) for m in messages]


@router.post("/{conversation_id}/messages")
async def send_conversation_message(
    conversation_id: int,
    data: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Envia mensagem para o contato via WhatsApp"""
    from app.integrations.whatsapp_meta import send_message as wa_send

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    # Envia via Meta Cloud API pelo canal correto
    channel_slug = conversation.channel or "cs"
    result = await wa_send(conversation.contact_phone, data.content, channel_slug=channel_slug)

    # Salva no banco
    message = conversation_service.add_outbound_message(
        db=db,
        conversation_id=conversation_id,
        content=data.content,
        sender_user_id=current_user.id,
        sender_type=MessageSenderType.AGENT,
        message_sid=result.get("message_id"),
    )

    return {"message": serialize_message(message), "whatsapp": result}


@router.patch("/{conversation_id}/assign")
def assign_conversation(
    conversation_id: int,
    data: AssignRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Atribui conversa a um atendente (user_id=null remove a atribuição)"""
    conv = conversation_service.assign_conversation(db, conversation_id, data.user_id)
    return serialize_conversation(conv)


@router.patch("/{conversation_id}/tags")
def update_tags(
    conversation_id: int,
    data: TagsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Atualiza as tags da conversa"""
    conv = conversation_service.update_tags(db, conversation_id, data.tags)
    return serialize_conversation(conv)


@router.patch("/{conversation_id}/notes")
def update_notes(
    conversation_id: int,
    data: NotesRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Atualiza as notas internas da conversa"""
    conv = conversation_service.update_notes(db, conversation_id, data.notes)
    return serialize_conversation(conv)


@router.patch("/{conversation_id}/read")
def mark_as_read(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Marca conversa como lida"""
    conv = conversation_service.mark_as_read(db, conversation_id)
    return serialize_conversation(conv)


@router.patch("/{conversation_id}/status")
def change_status(
    conversation_id: int,
    data: StatusRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Altera status da conversa"""
    try:
        new_status = ConversationStatus(data.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Status inválido: {data.status}")
    conv = conversation_service.change_status(db, conversation_id, new_status)
    return serialize_conversation(conv)


# ========================
# MÍDIA
# ========================

MEDIA_TYPE_MAP = {"image": "image", "document": "document", "audio": "audio", "video": "video"}
MEDIA_PREVIEW = {"image": "[Imagem]", "audio": "[Áudio]", "video": "[Vídeo]", "document": "[Documento]"}


def _transcode_audio_to_ogg(raw: bytes, src_mime: str) -> tuple[bytes, str, str] | None:
    """Converte áudio (webm/mp4...) para ogg/opus via ffmpeg.
    Retorna (bytes, mime, filename) ou None se já for ogg / ffmpeg ausente / falha."""
    if "ogg" in (src_mime or ""):
        return None
    if not shutil.which("ffmpeg"):
        return None
    fin_path = fout_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".in", delete=False) as fin:
            fin.write(raw)
            fin_path = fin.name
        fout_path = fin_path + ".ogg"
        subprocess.run(
            ["ffmpeg", "-y", "-i", fin_path, "-c:a", "libopus", "-b:a", "32k", fout_path],
            check=True, capture_output=True, timeout=30,
        )
        with open(fout_path, "rb") as f:
            out = f.read()
        if out:
            return out, "audio/ogg", "audio.ogg"
    except Exception:
        return None
    finally:
        for p in (fin_path, fout_path):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
    return None


@router.post("/{conversation_id}/media")
async def send_conversation_media(
    conversation_id: int,
    file: UploadFile = File(...),
    type: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Envia mídia (imagem/áudio/vídeo/documento) para o contato via WhatsApp."""
    from app.integrations.whatsapp_meta import upload_media, send_media_message

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    media_type = MEDIA_TYPE_MAP.get(type, "document")
    channel_slug = conversation.channel or "cs"
    file_bytes = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    filename = file.filename or "arquivo"

    # Áudio gravado no navegador costuma vir como webm (Chrome). WhatsApp só toca voz em ogg/opus.
    if media_type == "audio":
        converted = _transcode_audio_to_ogg(file_bytes, mime_type)
        if converted:
            file_bytes, mime_type, filename = converted

    try:
        media_id = await upload_media(file_bytes, mime_type, filename, channel_slug=channel_slug)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha no upload da mídia: {e}")

    caption = filename if media_type == "document" else None
    result = await send_media_message(
        conversation.contact_phone, media_id, media_type,
        channel_slug=channel_slug, caption=caption,
        filename=filename if media_type == "document" else None,
    )
    if result.get("status") != "sent":
        raise HTTPException(status_code=502, detail=f"Falha no envio: {result.get('error')}")

    content = f"media:{media_id}|{mime_type}|{filename}"
    message = conversation_service.add_outbound_message(
        db=db,
        conversation_id=conversation_id,
        content=content,
        sender_user_id=current_user.id,
        sender_type=MessageSenderType.AGENT,
        message_sid=result.get("message_id"),
        message_type=media_type,
        preview=MEDIA_PREVIEW.get(media_type, "[Mídia]"),
    )
    return {"message": serialize_message(message), "whatsapp": result}


@router.get("/media/{media_id}")
async def get_conversation_media(media_id: str, channel: str = "cs", db: Session = Depends(get_db)):
    """Proxy público que baixa a mídia da Meta. Só serve media_id já salvo em conversation_messages."""
    exists = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.content.like(f"media:{media_id}|%"))
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Mídia não encontrada")

    ch = get_channel(channel)
    if not ch or not ch.is_configured:
        raise HTTPException(status_code=400, detail="Canal inválido")

    async with httpx.AsyncClient(timeout=60) as client:
        meta = await client.get(
            f"{GRAPH_API_URL}/{media_id}",
            headers={"Authorization": f"Bearer {ch.token}"},
        )
        url_data = meta.json()
        media_url = url_data.get("url")
        if not media_url:
            raise HTTPException(status_code=404, detail="URL da mídia não encontrada")
        media_resp = await client.get(
            media_url, headers={"Authorization": f"Bearer {ch.token}"}
        )

    return Response(
        content=media_resp.content,
        media_type=url_data.get("mime_type", "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/{conversation_id}/template")
async def send_conversation_template(
    conversation_id: int,
    data: TemplateMessageRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Envia um template aprovado para o contato da conversa e salva o texto renderizado."""
    from app.integrations.whatsapp_meta import send_template

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    channel_slug = conversation.channel or "cs"

    components = None
    if data.params:
        components = [{
            "type": "body",
            "parameters": [{"type": "text", "text": p} for p in data.params],
        }]

    result = await send_template(
        conversation.contact_phone,
        data.template_name,
        language=data.language,
        components=components,
        channel_slug=channel_slug,
        register=False,
    )
    if result.get("status") != "sent":
        raise HTTPException(status_code=502, detail=f"Falha no envio: {result.get('error')}")

    content = data.rendered_text.strip() if (data.rendered_text and data.rendered_text.strip()) else f"[Template: {data.template_name}]"
    message = conversation_service.add_outbound_message(
        db=db,
        conversation_id=conversation_id,
        content=content,
        sender_user_id=current_user.id,
        sender_type=MessageSenderType.AGENT,
        message_sid=result.get("message_id"),
        message_type="text",
        preview=content[:255],
    )
    return {"message": serialize_message(message), "whatsapp": result}