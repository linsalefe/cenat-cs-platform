from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.conversation import (
    Conversation,
    ConversationMessage,
    ConversationStatus,
    MessageDirection,
    MessageSenderType,
)
from app.models.student import Student


def get_or_create_conversation(db: Session, phone: str, channel: str = "cs") -> Conversation:
    """Busca conversa existente pelo telefone e canal ou cria uma nova"""
    phone_clean = phone.replace("+", "").replace("whatsapp:", "")
    phone_suffix = phone_clean[-9:]

    # Busca conversa aberta pelo sufixo do telefone e canal
    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.status.in_([ConversationStatus.OPEN, ConversationStatus.IN_PROGRESS]),
            Conversation.channel == channel,
        )
        .all()
    )

    conversation = None
    for conv in conversations:
        if conv.contact_phone and conv.contact_phone[-9:] == phone_suffix:
            conversation = conv
            break

    if conversation:
        return conversation

    # Busca aluno pelo telefone
    student = db.query(Student).filter(
        Student.phone.ilike(f"%{phone_suffix}%")
    ).first()

    conversation = Conversation(
        contact_phone=phone_clean,
        contact_name=student.name if student else f"WhatsApp {phone_clean}",
        student_id=student.id if student else None,
        channel=channel,
        status=ConversationStatus.OPEN,
    )
    db.add(conversation)
    db.flush()
    return conversation


def add_inbound_message(db: Session, phone: str, content: str, message_sid: str = None, channel: str = "cs", message_type: str = "text", preview: str = None) -> ConversationMessage:
    """Registra mensagem recebida do contato"""
    # Deduplicação: se já existe mensagem com esse message_sid, ignora
    if message_sid:
        existing = db.query(ConversationMessage).filter(
            ConversationMessage.message_sid == message_sid
        ).first()
        if existing:
            return existing

    conversation = get_or_create_conversation(db, phone, channel=channel)

    message = ConversationMessage(
        conversation_id=conversation.id,
        direction=MessageDirection.INBOUND,
        sender_type=MessageSenderType.STUDENT,
        content=content,
        message_type=message_type,
        message_sid=message_sid,
        status="received",
    )
    db.add(message)

    conversation.last_message_at = datetime.utcnow()
    _preview = preview if preview else content
    conversation.last_message_preview = _preview[:255] if _preview else ""
    conversation.unread_count = (conversation.unread_count or 0) + 1

    if conversation.status == ConversationStatus.RESOLVED:
        conversation.status = ConversationStatus.OPEN

    db.commit()
    db.refresh(message)
    return message


def add_outbound_message(
    db: Session,
    conversation_id: int,
    content: str,
    sender_user_id: int = None,
    sender_type: MessageSenderType = MessageSenderType.AGENT,
    message_sid: str = None,
    message_type: str = "text",
    preview: str = None,
) -> ConversationMessage:
    """Registra mensagem enviada pela equipe"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise ValueError("Conversa não encontrada")

    message = ConversationMessage(
        conversation_id=conversation.id,
        direction=MessageDirection.OUTBOUND,
        sender_type=sender_type,
        sender_user_id=sender_user_id,
        content=content,
        message_type=message_type,
        message_sid=message_sid,
        status="sent",
    )
    db.add(message)

    conversation.last_message_at = datetime.utcnow()
    _preview = preview if preview else content
    conversation.last_message_preview = _preview[:255] if _preview else ""

    if conversation.status == ConversationStatus.OPEN:
        conversation.status = ConversationStatus.IN_PROGRESS

    db.commit()
    db.refresh(message)
    return message


def list_conversations(
    db: Session,
    status: str = None,
    assigned_to_id: int = None,
    unread_only: bool = False,
    channel: str = None,
) -> list:
    """Lista conversas com filtros"""
    query = db.query(Conversation).order_by(desc(Conversation.last_message_at))

    if channel:
        query = query.filter(Conversation.channel == channel)
    if status:
        query = query.filter(Conversation.status == status)
    if assigned_to_id:
        query = query.filter(Conversation.assigned_to_id == assigned_to_id)
    if unread_only:
        query = query.filter(Conversation.unread_count > 0)

    return query.all()


def get_conversation_messages(db: Session, conversation_id: int) -> list:
    """Retorna mensagens de uma conversa"""
    return (
        db.query(ConversationMessage)
        .filter(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at)
        .all()
    )


def assign_conversation(db: Session, conversation_id: int, user_id: int) -> Conversation:
    """Atribui conversa a um atendente (user_id=None remove a atribuição)"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise ValueError("Conversa não encontrada")

    conversation.assigned_to_id = user_id
    if user_id is not None and conversation.status == ConversationStatus.OPEN:
        conversation.status = ConversationStatus.IN_PROGRESS

    db.commit()
    db.refresh(conversation)
    return conversation


def update_tags(db: Session, conversation_id: int, tags: list) -> Conversation:
    """Atualiza tags da conversa (remove vazios e duplicados)"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise ValueError("Conversa não encontrada")

    clean = []
    for t in (tags or []):
        t = (t or "").strip()
        if t and t not in clean:
            clean.append(t)
    conversation.tags = clean

    db.commit()
    db.refresh(conversation)
    return conversation


def update_notes(db: Session, conversation_id: int, notes: str) -> Conversation:
    """Atualiza notas internas da conversa"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise ValueError("Conversa não encontrada")

    conversation.notes = notes or ""

    db.commit()
    db.refresh(conversation)
    return conversation


def mark_as_read(db: Session, conversation_id: int) -> Conversation:
    """Zera contagem de não lidas"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise ValueError("Conversa não encontrada")

    conversation.unread_count = 0
    db.commit()
    db.refresh(conversation)
    return conversation


def change_status(db: Session, conversation_id: int, new_status: ConversationStatus) -> Conversation:
    """Altera status da conversa"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise ValueError("Conversa não encontrada")

    conversation.status = new_status
    db.commit()
    db.refresh(conversation)
    return conversation


def add_outbound_message_by_phone(
    db: Session,
    phone: str,
    content: str,
    sender_type: MessageSenderType = MessageSenderType.SYSTEM,
    message_sid: str = None,
    channel: str = "cs",
) -> ConversationMessage:
    """Registra mensagem enviada pelo sistema (automações, templates, etc.)"""
    conversation = get_or_create_conversation(db, phone, channel=channel)

    message = ConversationMessage(
        conversation_id=conversation.id,
        direction=MessageDirection.OUTBOUND,
        sender_type=sender_type,
        content=content,
        message_sid=message_sid,
        status="sent",
    )
    db.add(message)

    conversation.last_message_at = datetime.utcnow()
    conversation.last_message_preview = content[:255] if content else ""

    db.commit()
    db.refresh(message)
    return message
