import os
from datetime import datetime, timedelta
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
                # F3.C: rastreia botão clicado pra retomar workflows waiting_button depois
                clicked_button_text: str = ""
                clicked_button_legacy_id: str = ""  # pra journey_service legado

                if msg_type == "interactive":
                    interactive = message.get("interactive", {})
                    btn_reply = interactive.get("button_reply", {})
                    if btn_reply:
                        button_id = btn_reply.get("id", "")
                        button_text = btn_reply.get("title", "")
                        body = f"[Botão: {button_text}]"
                        clicked_button_text = button_text
                        clicked_button_legacy_id = button_id

                        # Processa clique na régua (legado, só pra StudentJourney)
                        try:
                            from app.services.journey_service import handle_button_click
                            temp_db = next(get_db())
                            result = handle_button_click(temp_db, normalize_br_phone(from_number), button_id)
                            if result:
                                print(f"🔘 Botão '{button_text}' processado pela régua: {result['action']}")
                            temp_db.close()
                        except Exception as e:
                            print(f"❌ Erro ao processar botão da régua: {e}")
                    else:
                        body = "[Interação]"
                elif msg_type == "button":
                    # F3.C: clique em quick-reply de TEMPLATE (não vem como interactive)
                    button = message.get("button", {})
                    button_text = button.get("text", "") or button.get("payload", "")
                    body = f"[Botão: {button_text}]"
                    clicked_button_text = button_text
                    clicked_button_legacy_id = button.get("payload", "") or button_text
                    try:
                        from app.services.journey_service import handle_button_click
                        temp_db = next(get_db())
                        result = handle_button_click(temp_db, normalize_br_phone(from_number), clicked_button_legacy_id)
                        if result:
                            print(f"🔘 Botão template '{button_text}' processado pela régua: {result['action']}")
                        temp_db.close()
                    except Exception as e:
                        print(f"❌ Erro ao processar botão template na régua: {e}")
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
                            db=db, phone=phone, content=body, message_sid=message_id, channel=channel_slug
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

                    # E3: retoma runs waiting_reply daquele aluno
                    try:
                        from app.services import workflow_dispatcher
                        resumed = workflow_dispatcher.handle_student_replied(db, student.id)
                        if resumed > 0:
                            print(f"💬 {resumed} workflow run(s) retomada(s) após resposta do aluno {student.id}")
                    except Exception as _exc:  # noqa: BLE001
                        print(f"⚠️ Falha ao retomar workflows após inbound: {_exc}")

                    # F3.C: retoma runs waiting_button se foi clique em botão
                    if clicked_button_text:
                        try:
                            from app.services import workflow_dispatcher
                            from app.services.workflow_engine import _slugify_button_text
                            button_slug = _slugify_button_text(clicked_button_text)
                            if button_slug:
                                resumed = workflow_dispatcher.handle_student_button_click(
                                    db, student.id, button_slug, clicked_text=clicked_button_text
                                )
                                if resumed > 0:
                                    print(f"🔘 {resumed} workflow run(s) retomada(s) por clique em '{clicked_button_text}' (slug={button_slug})")
                        except Exception as _exc:  # noqa: BLE001
                            print(f"⚠️ Falha ao retomar workflows após button click: {_exc}")

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
                        # Já tem ticket aberto — só adiciona mensagem, sem protocolo
                        ticket_service.add_message(
                            db=db,
                            ticket=open_ticket,
                            content=body,
                            sender_type=MessageSender.STUDENT,
                        )
                        if open_ticket.status == TicketStatus.WAITING_STUDENT:
                            ticket_service.change_status(db, open_ticket, TicketStatus.OPEN)
                    else:
                        # Verifica se teve ticket resolvido nas últimas 24h
                        cutoff = datetime.utcnow() - timedelta(hours=24)
                        recent_resolved = db.query(Ticket).filter(
                            Ticket.student_id == student.id,
                            Ticket.status == TicketStatus.RESOLVED,
                            Ticket.updated_at >= cutoff,
                        ).order_by(Ticket.updated_at.desc()).first()

                        if recent_resolved:
                            # Reabre o ticket resolvido recentemente
                            ticket_service.change_status(db, recent_resolved, TicketStatus.OPEN)
                            ticket_service.add_message(
                                db=db,
                                ticket=recent_resolved,
                                content=body,
                                sender_type=MessageSender.STUDENT,
                            )
                            print(f"🔄 Ticket {recent_resolved.protocol} reaberto")
                        else:
                            # Cria ticket novo — mais de 24h ou primeiro contato
                            ticket = ticket_service.create_ticket(
                                db=db,
                                student_id=student.id,
                                category=TicketCategory.OTHER,
                                priority=TicketPriority.MEDIUM,
                                subject=f"Contato via WhatsApp ({channel.name})",
                                message=body,
                            )
                            # Envia protocolo só pra tickets novos
                            background_tasks.add_task(
                                send_protocol_confirmation, phone, ticket.protocol, channel_slug
                            )

                except Exception as e:
                    db.rollback()
                    print(f"❌ Erro no webhook Meta ({channel.name}): {e}")
                finally:
                    db.close()

    return Response(content="ok", status_code=200)
