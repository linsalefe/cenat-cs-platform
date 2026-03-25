from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.deps import get_db, get_current_user
from app.services import conversation_service
from app.models.conversation import Conversation, ConversationStatus, MessageSenderType

router = APIRouter(prefix="/conversations", tags=["conversations"])


class SendMessageRequest(BaseModel):
    content: str


class AssignRequest(BaseModel):
    user_id: int


class StatusRequest(BaseModel):
    status: str


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
    """Atribui conversa a um atendente"""
    conv = conversation_service.assign_conversation(db, conversation_id, data.user_id)
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