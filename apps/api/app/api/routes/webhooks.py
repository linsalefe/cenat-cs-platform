import os
from fastapi import APIRouter, Request, BackgroundTasks
from fastapi.responses import Response, PlainTextResponse

from app.core.deps import get_db
from app.core.whatsapp_channels import get_channel_by_phone_id
from app.models.student import Student
from app.models.ticket import Ticket, TicketStatus, TicketCategory, TicketPriority
from app.models.ticket_message import TicketMessage, MessageSender
from app.services import ticket_service
from app.integrations.whatsapp_meta import send_message, mark_as_read, normalize_br_phone
from app.services import conversation_service

WEBHOOK_VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN", "cenat_webhook_2024")

router = APIRouter(prefix="/webhook", tags=["webhooks"])


async def send_protocol_confirmation(phone: str, protocol: str, channel_slug: str):
    """Envia confirmação de protocolo ao aluno"""
    message = f"""✅ *Recebemos sua mensagem!*

Seu protocolo de atendimento é:
*{protocol}*

Nossa equipe vai analisar e responder em breve.

_CENAT - Sistema de Atendimento_"""

    try:
        await send_message(phone, message, channel_slug=channel_slug)
    except Exception as e:
        print(f"Erro ao enviar confirmação: {e}")


@router.get("/whatsapp")
async def whatsapp_verify(request: Request):
    """Verificação do webhook pela Meta (GET)"""
    params = request.query_params
    mode = params.get("hub.mode", "")
    token = params.get("hub.verify_token", "")
    challenge = params.get("hub.challenge", "")

    if mode == "subscribe" and token == WEBHOOK_VERIFY_TOKEN:
        print(f"✅ Webhook verificado pela Meta")
        return PlainTextResponse(content=challenge, status_code=200)

    return PlainTextResponse(content="Forbidden", status_code=403)


@router.post("/whatsapp")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """Recebe mensagens do WhatsApp via Meta Cloud API"""
    try:
        data = await request.json()
    except Exception:
        return Response(content="ok", status_code=200)

    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})

            if "messages" not in value:
                continue

            # Identifica o canal pelo phone_number_id
            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id", "")
            channel = get_channel_by_phone_id(phone_number_id)

            if not channel:
                print(f"⚠️ Canal não encontrado para phone_number_id: {phone_number_id}")
                continue

            channel_slug = channel.slug
            print(f"📨 Mensagem recebida no canal: {channel.name}")

            for message in value.get("messages", []):
                msg_type = message.get("type", "")
                from_number = message.get("from", "")
                message_id = message.get("id", "")

                # Extrai texto
                body = ""
                if msg_type == "text":
                    body = message.get("text", {}).get("body", "")
                elif msg_type == "image":
                    body = message.get("image", {}).get("caption", "[Imagem]") or "[Imagem]"
                elif msg_type == "audio":
                    body = "[Áudio]"
                elif msg_type == "video":
                    body = "[Vídeo]"
                elif msg_type == "document":
                    body = "[Documento]"
                elif msg_type == "location":
                    body = "[Localização]"
                elif msg_type == "sticker":
                    body = "[Figurinha]"
                elif msg_type == "reaction":
                    continue
                else:
                    body = f"[{msg_type}]"

                if not body:
                    continue

                phone = normalize_br_phone(from_number)

                # Marca como lida
                background_tasks.add_task(mark_as_read, message_id, channel_slug)

                db = next(get_db())

                try:
                    # Salva mensagem na conversa
                    try:
                        conversation_service.add_inbound_message(
                            db=db, phone=phone, content=body, message_sid=message_id
                        )
                    except Exception as e:
                        print(f"Erro ao salvar mensagem na conversa: {e}")

                    # Busca aluno pelo telefone
                    phone_clean = phone.replace("55", "", 1) if phone.startswith("55") else phone
                    student = db.query(Student).filter(
                        Student.phone.ilike(f"%{phone_clean[-9:]}%")
                    ).first()

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
                        Ticket.status.in_([
                            TicketStatus.OPEN,
                            TicketStatus.IN_PROGRESS,
                            TicketStatus.WAITING_STUDENT
                        ])
                    ).order_by(Ticket.created_at.desc()).first()

                    if open_ticket:
                        ticket_service.add_message(
                            db=db,
                            ticket=open_ticket,
                            content=body,
                            sender_type=MessageSender.STUDENT,
                        )
                        if open_ticket.status == TicketStatus.WAITING_STUDENT:
                            ticket_service.change_status(db, open_ticket, TicketStatus.OPEN)
                    else:
                        ticket = ticket_service.create_ticket(
                            db=db,
                            student_id=student.id,
                            category=TicketCategory.OTHER,
                            priority=TicketPriority.MEDIUM,
                            subject=f"Contato via WhatsApp ({channel.name})",
                            message=body,
                        )
                        background_tasks.add_task(
                            send_protocol_confirmation, phone, ticket.protocol, channel_slug
                        )

                except Exception as e:
                    db.rollback()
                    print(f"❌ Erro no webhook Meta ({channel.name}): {e}")
                finally:
                    db.close()

    return Response(content="ok", status_code=200)
