from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.ticket import Ticket, TicketStatus, TicketCategory, TicketPriority
from app.models.ticket_message import TicketMessage, MessageSender
from app.models.ticket_status_history import TicketStatusHistory


# SLA por categoria (em horas)
SLA_HOURS = {
    TicketCategory.FINANCIAL: 24,
    TicketCategory.ACADEMIC: 48,
    TicketCategory.TECHNICAL: 24,
    TicketCategory.ADMINISTRATIVE: 48,
    TicketCategory.OTHER: 72,
}


def generate_protocol() -> str:
    """Gera protocolo único no formato SEC-YYYYMMDD-HHMMSS-XXXX"""
    import uuid
    now = datetime.utcnow()
    suffix = uuid.uuid4().hex[:4].upper()
    return f"SEC-{now.strftime('%Y%m%d-%H%M%S')}-{suffix}"


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
    
    ticket = Ticket(
        protocol=generate_protocol(),
        student_id=student_id,
        category=category,
        priority=priority,
        subject=subject,
        status=TicketStatus.OPEN,
        sla_deadline=calculate_sla_deadline(category),
    )
    
    db.add(ticket)
    db.flush()
    
    # Registra histórico inicial
    history = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=None,
        new_status=TicketStatus.OPEN,
    )
    db.add(history)
    
    # Adiciona mensagem inicial se fornecida
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
    """Altera status do ticket e registra histórico"""
    
    old_status = ticket.status
    
    # Registra histórico
    history = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=new_status,
        changed_by_id=user_id,
    )
    db.add(history)
    
    # Atualiza ticket
    ticket.status = new_status
    
    # Se resolvido/fechado, registra data
    if new_status in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
        ticket.resolved_at = datetime.utcnow()
        
        # Dispara CSAT automaticamente
        try:
            from app.services.feedback_service import create_feedback_request
            from app.models.feedback import FeedbackType, FeedbackTrigger
            
            feedback = create_feedback_request(
                db=db,
                student_id=ticket.student_id,
                feedback_type=FeedbackType.CSAT,
                trigger=FeedbackTrigger.TICKET_CLOSED,
                reference_type="ticket",
                reference_id=ticket.id,
            )
            
            # Envia WhatsApp com pesquisa (assíncrono em background)
            _send_csat_whatsapp_async(db, ticket, feedback)
            
        except Exception as e:
            print(f"Erro ao criar feedback: {e}")
    
    db.commit()
    db.refresh(ticket)
    
    return ticket


def _send_csat_whatsapp_async(db: Session, ticket: Ticket, feedback):
    """Envia CSAT via WhatsApp (fire and forget)"""
    import asyncio
    from app.models.student import Student
    
    student = db.query(Student).filter(Student.id == ticket.student_id).first()
    if not student or not student.phone:
        return
    
    async def send():
        try:
            from app.integrations.whatsapp_meta import send_message
            
            message = f"""Olá {student.name}! 👋

Seu atendimento *{ticket.protocol}* foi finalizado.

Como você avalia nosso atendimento?
Responda de 1 a 5 (1=Péssimo, 5=Excelente):

https://cs.cenat.com.br/feedback/{feedback.token}

Obrigado! ��
_CENAT - Cuidado ao Aluno_"""
            
            await send_message(student.phone, message)
        except Exception as e:
            print(f"Erro ao enviar CSAT WhatsApp: {e}")
    
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(send())
        else:
            asyncio.run(send())
    except:
        pass


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
    db.commit()
    db.refresh(message)
    
    return message


def assign_ticket(
    db: Session,
    ticket: Ticket,
    user_id: int,
) -> Ticket:
    """Atribui ticket a um usuário"""
    
    ticket.assigned_to_id = user_id
    
    # Se estava aberto, muda para em andamento
    if ticket.status == TicketStatus.OPEN:
        change_status(db, ticket, TicketStatus.IN_PROGRESS, user_id)
    else:
        db.commit()
        db.refresh(ticket)
    
    return ticket
