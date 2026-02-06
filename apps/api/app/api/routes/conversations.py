from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.deps import get_db, get_current_user
from app.services import conversation_service
from app.models.conversation import ConversationStatus, MessageSenderType

router = APIRouter(prefix="/conversations", tags=["conversations"])


class SendMessageRequest(BaseModel):
    content: str


class AssignRequest(BaseModel):
    user_id: int


class StatusRequest(BaseModel):
    status: str


@router.get("")
def list_conversations(
    status: Optional[str] = None,
    channel: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lista todas as conversas"""
    return conversation_service.list_conversations(db, status, assigned_to_id, unread_only, channel=channel)


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retorna detalhes de uma conversa"""
    from app.models.conversation import Conversation
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return conversation


@router.get("/{conversation_id}/messages")
def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retorna mensagens de uma conversa"""
    return conversation_service.get_conversation_messages(db, conversation_id)


@router.post("/{conversation_id}/messages")
async def send_conversation_message(
    conversation_id: int,
    data: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Envia mensagem para o contato via WhatsApp"""
    from app.models.conversation import Conversation
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

    return {"message": message, "whatsapp": result}


@router.patch("/{conversation_id}/assign")
def assign_conversation(
    conversation_id: int,
    data: AssignRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Atribui conversa a um atendente"""
    return conversation_service.assign_conversation(db, conversation_id, data.user_id)


@router.patch("/{conversation_id}/read")
def mark_as_read(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Marca conversa como lida"""
    return conversation_service.mark_as_read(db, conversation_id)


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
    return conversation_service.change_status(db, conversation_id, new_status)
