from fastapi import APIRouter, Request, BackgroundTasks, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.models.student import Student
from app.models.ticket import Ticket, TicketStatus, TicketCategory, TicketPriority
from app.models.ticket_message import TicketMessage, MessageSender
from app.services import ticket_service
from app.integrations.twilio_service import send_message, format_phone

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
    """Recebe mensagens do Twilio WhatsApp"""
    try:
        form_data = await request.form()
    except Exception:
        return Response(content="", status_code=200)

    # Campos enviados pelo Twilio
    body = form_data.get("Body", "")
    from_number = form_data.get("From", "")        # whatsapp:+5583988046720
    to_number = form_data.get("To", "")
    message_sid = form_data.get("MessageSid", "")
    num_media = int(form_data.get("NumMedia", "0"))

    # Ignora se não tem texto
    if not body:
        return Response(content="", status_code=200)

    # Extrai telefone (remove "whatsapp:+" do início)
    phone = from_number.replace("whatsapp:", "").replace("+", "")

    # Processa no banco
    db = next(get_db())

    try:
        # Busca aluno pelo telefone (últimos 9 dígitos)
        phone_clean = phone.replace("55", "", 1) if phone.startswith("55") else phone
        student = db.query(Student).filter(
            Student.phone.ilike(f"%{phone_clean[-9:]}%")
        ).first()

        # Se não encontrar, cria aluno temporário
        if not student:
            student = Student(
                name=f"WhatsApp {phone}",
                email=f"{phone}@whatsapp.temp",
                phone=phone,
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
                content=body,
                sender_type=MessageSender.STUDENT,
            )

            # Se estava aguardando aluno, volta para aberto
            if open_ticket.status == TicketStatus.WAITING_STUDENT:
                ticket_service.change_status(db, open_ticket, TicketStatus.OPEN)

            return Response(content="", status_code=200)
        else:
            # Cria novo ticket
            ticket = ticket_service.create_ticket(
                db=db,
                student_id=student.id,
                category=TicketCategory.OTHER,
                priority=TicketPriority.MEDIUM,
                subject="Contato via WhatsApp",
                message=body,
            )

            # Envia confirmação em background
            background_tasks.add_task(send_protocol_confirmation, phone, ticket.protocol)

            return Response(content="", status_code=200)

    except Exception as e:
        db.rollback()
        print(f"Erro no webhook Twilio: {e}")
        return Response(content="", status_code=200)
    finally:
        db.close()