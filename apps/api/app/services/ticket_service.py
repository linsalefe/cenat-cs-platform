from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.ticket import Ticket, TicketStatus, TicketCategory, TicketPriority
from app.models.ticket_message import TicketMessage, MessageSender
from app.models.ticket_status_history import TicketStatusHistory


# SLA em horas por categoria
SLA_HOURS = {
    TicketCategory.FINANCIAL: 24,
    TicketCategory.ACADEMIC: 48,
    TicketCategory.TECHNICAL: 24,
    TicketCategory.ADMINISTRATIVE: 48,
    TicketCategory.OTHER: 72,
}


def generate_protocol() -> str:
    """Gera protocolo no formato SEC-YYYYMMDD-XXXXXX"""
    now = datetime.utcnow()
    date_part = now.strftime("%Y%m%d")
    time_part = now.strftime("%H%M%S")
    return f"SEC-{date_part}-{time_part}"


def calculate_sla_deadline(category: TicketCategory) -> datetime:
    """Calcula prazo do SLA baseado na categoria"""
    hours = SLA_HOURS.get(category, 72)
    return datetime.utcnow() + timedelta(hours=hours)


def create_ticket(
    db: Session,
    student_id: int,
    category: TicketCategory,
    priority: TicketPriority,
    subject: str | None = None,
    message: str | None = None,
) -> Ticket:
    """Cria um novo ticket"""
    protocol = generate_protocol()
    sla_deadline = calculate_sla_deadline(category)

    ticket = Ticket(
        protocol=protocol,
        student_id=student_id,
        category=category,
        priority=priority,
        subject=subject,
        status=TicketStatus.OPEN,
        sla_deadline=sla_deadline,
    )
    db.add(ticket)
    db.flush()

    # Registra histórico de status
    history = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=None,
        new_status=TicketStatus.OPEN.value,
    )
    db.add(history)

    # Adiciona mensagem inicial se houver
    if message:
        msg = TicketMessage(
            ticket_id=ticket.id,
            sender_type=MessageSender.STUDENT,
            content=message,
        )
        db.add(msg)

    db.commit()
    db.refresh(ticket)
    return ticket


def change_status(
    db: Session,
    ticket: Ticket,
    new_status: TicketStatus,
    user_id: int | None = None,
) -> Ticket:
    """Altera o status do ticket"""
    old_status = ticket.status

    ticket.status = new_status
    ticket.updated_at = datetime.utcnow()

    if new_status == TicketStatus.RESOLVED:
        ticket.resolved_at = datetime.utcnow()

    # Registra histórico
    history = TicketStatusHistory(
        ticket_id=ticket.id,
        changed_by_id=user_id,
        old_status=old_status.value,
        new_status=new_status.value,
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)
    return ticket


def assign_ticket(
    db: Session,
    ticket: Ticket,
    user_id: int,
) -> Ticket:
    """Atribui ticket a um usuário"""
    ticket.assigned_to_id = user_id
    ticket.updated_at = datetime.utcnow()

    if ticket.status == TicketStatus.OPEN:
        change_status(db, ticket, TicketStatus.IN_PROGRESS, user_id)
    else:
        db.commit()
        db.refresh(ticket)

    return ticket


def add_message(
    db: Session,
    ticket: Ticket,
    content: str,
    sender_type: MessageSender,
    sender_user_id: int | None = None,
) -> TicketMessage:
    """Adiciona mensagem ao ticket"""
    message = TicketMessage(
        ticket_id=ticket.id,
        sender_type=sender_type,
        sender_user_id=sender_user_id,
        content=content,
    )
    db.add(message)

    ticket.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(message)
    return message
