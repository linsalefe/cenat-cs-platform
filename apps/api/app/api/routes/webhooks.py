from fastapi import APIRouter, Request, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.models.student import Student
from app.models.ticket import Ticket, TicketStatus, TicketCategory, TicketPriority
from app.models.ticket_message import TicketMessage, MessageSender
from app.services import ticket_service
from app.integrations.whatsapp import send_message, format_phone

router = APIRouter(prefix="/webhook", tags=["webhooks"])


async def send_protocol_confirmation(phone: str, protocol: str):
    """Envia confirmação de protocolo ao aluno"""
    message = f"""✅ *Recebemos sua mensagem!*

Seu protocolo de atendimento é:
*{protocol}*

Nossa equipe vai analisar e responder em breve.

_CENAT - Sistema de Atendimento_"""
    
    try:
        await send_message(phone, message)
    except Exception as e:
        print(f"Erro ao enviar confirmação: {e}")


@router.post("/whatsapp")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """Recebe mensagens do Evolution API"""
    try:
        data = await request.json()
    except:
        return {"status": "ignored", "reason": "invalid json"}
    
    # Evolution envia diferentes tipos de eventos
    event_type = data.get("event")
    
    # Processa apenas mensagens recebidas
    if event_type != "messages.upsert":
        return {"status": "ignored", "reason": f"event type: {event_type}"}
    
    message_data = data.get("data", {})
    
    # Ignora mensagens enviadas por nós
    if message_data.get("key", {}).get("fromMe", False):
        return {"status": "ignored", "reason": "message from me"}
    
    # Extrai informações da mensagem
    remote_jid = message_data.get("key", {}).get("remoteJid", "")
    phone = remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
    
    # Ignora grupos
    if "@g.us" in remote_jid:
        return {"status": "ignored", "reason": "group message"}
    
    # Extrai texto da mensagem
    message_content = message_data.get("message", {})
    text = (
        message_content.get("conversation") or
        message_content.get("extendedTextMessage", {}).get("text") or
        ""
    )
    
    if not text:
        return {"status": "ignored", "reason": "no text content"}
    
    # Processa no banco
    db = next(get_db())
    
    try:
        # Busca aluno pelo telefone
        phone_clean = format_phone(phone)
        student = db.query(Student).filter(
            Student.phone.ilike(f"%{phone_clean[-9:]}%")
        ).first()
        
        # Se não encontrar, cria aluno temporário
        if not student:
            student = Student(
                name=f"WhatsApp {phone_clean}",
                email=f"{phone_clean}@whatsapp.temp",
                phone=phone_clean,
            )
            db.add(student)
            db.flush()
        
        # Busca ticket aberto do aluno
        open_ticket = db.query(Ticket).filter(
            Ticket.student_id == student.id,
            Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_STUDENT])
        ).order_by(Ticket.created_at.desc()).first()
        
        if open_ticket:
            # Adiciona mensagem ao ticket existente
            ticket_service.add_message(
                db=db,
                ticket=open_ticket,
                content=text,
                sender_type=MessageSender.STUDENT,
            )
            
            # Se estava aguardando aluno, volta para aberto
            if open_ticket.status == TicketStatus.WAITING_STUDENT:
                ticket_service.change_status(db, open_ticket, TicketStatus.OPEN)
            
            return {"status": "ok", "action": "message_added", "ticket_id": open_ticket.id}
        else:
            # Cria novo ticket
            ticket = ticket_service.create_ticket(
                db=db,
                student_id=student.id,
                category=TicketCategory.OTHER,
                priority=TicketPriority.MEDIUM,
                subject="Contato via WhatsApp",
                message=text,
            )
            
            # Envia confirmação em background
            background_tasks.add_task(send_protocol_confirmation, phone_clean, ticket.protocol)
            
            return {"status": "ok", "action": "ticket_created", "ticket_id": ticket.id, "protocol": ticket.protocol}
    
    except Exception as e:
        db.rollback()
        return {"status": "error", "detail": str(e)}
    finally:
        db.close()
