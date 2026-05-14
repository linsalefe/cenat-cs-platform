import re
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
import httpx

from app.core.deps import get_current_user
from app.core.whatsapp_channels import get_channel

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


# ============================================================
# Helpers
# ============================================================

def _resolve_channel(slug: str):
    """Resolve canal pelo slug. 400 se não existe/não configurado."""
    channel = get_channel(slug)
    if not channel or not channel.is_configured:
        raise HTTPException(400, f"Canal '{slug}' não configurado")
    return channel


def _extract_derived_fields(components: list) -> tuple[str, int, list]:
    """Dado o components[] da Meta, extrai body, contagem de placeholders e buttons."""
    body_text = ""
    buttons: list = []
    for comp in components or []:
        ctype = comp.get("type")
        if ctype == "BODY":
            body_text = comp.get("text", "") or ""
        elif ctype == "BUTTONS":
            buttons = comp.get("buttons", []) or []
    param_count = len(re.findall(r"\{\{\d+\}\}", body_text))
    return body_text, param_count, buttons


# ============================================================
# GET /templates
# ============================================================

@router.get("/templates")
async def list_templates(
    channel: str = Query("cs"),
    current_user=Depends(get_current_user),
):
    """Lista templates do WABA do canal especificado (todos os status)."""
    ch = get_channel(channel)
    if not ch or not ch.is_configured:
        return []

    url = f"https://graph.facebook.com/v22.0/{ch.waba_id}/message_templates"
    headers = {"Authorization": f"Bearer {ch.token}"}
    params = {"limit": 100}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=headers, params=params)
        data = r.json()

    if "error" in data:
        raise HTTPException(400, data["error"].get("message", "Erro ao buscar templates"))

    templates = []
    for t in data.get("data", []):
        components = t.get("components", []) or []
        body_text, param_count, buttons = _extract_derived_fields(components)

        templates.append({
            "id": t.get("id"),
            "name": t["name"],
            "language": t.get("language", "pt_BR"),
            "status": t.get("status", "UNKNOWN"),
            "category": t.get("category", ""),
            # Components íntegros (novo — usado por /templates/page.tsx)
            "components": components,
            # Campos derivados (compat com /broadcasts/new e workflow nodes)
            "body": body_text,
            "param_count": param_count,
            "buttons": buttons,
            "rejected_reason": t.get("rejected_reason"),
        })

    status_order = {"APPROVED": 0, "PENDING": 1, "REJECTED": 2}
    templates.sort(key=lambda t: (status_order.get(t["status"], 9), t["name"]))

    return templates


# ============================================================
# POST /templates
# ============================================================

class TemplateButton(BaseModel):
    type: Literal["QUICK_REPLY", "URL", "PHONE_NUMBER"]
    text: str = Field(..., min_length=1, max_length=25)
    url: Optional[str] = None
    phone_number: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    category: str = "UTILITY"
    language: str = "pt_BR"
    body: str
    header_text: Optional[str] = None
    footer_text: Optional[str] = None
    buttons: Optional[list[TemplateButton]] = None
    channel: str = "cs"


def _validate_buttons(buttons: list[TemplateButton]) -> dict:
    """Valida regras da Meta sobre buttons e devolve o component "BUTTONS" pronto pra Meta."""
    if not buttons:
        return {}

    has_qr = any(b.type == "QUICK_REPLY" for b in buttons)
    has_cta = any(b.type in ("URL", "PHONE_NUMBER") for b in buttons)

    if has_qr and has_cta:
        raise HTTPException(
            400,
            "Não é permitido misturar botões de resposta rápida com botões de ação (URL/telefone) no mesmo template",
        )

    if has_qr and len(buttons) > 3:
        raise HTTPException(400, "Máximo de 3 botões de resposta rápida por template")

    if has_cta and len(buttons) > 2:
        raise HTTPException(400, "Máximo de 2 botões de ação (URL/telefone) por template")

    # Valida campos por tipo
    out_buttons = []
    for b in buttons:
        if b.type == "QUICK_REPLY":
            out_buttons.append({"type": "QUICK_REPLY", "text": b.text})
        elif b.type == "URL":
            if not b.url:
                raise HTTPException(400, f"Botão URL '{b.text}' precisa de uma URL")
            out_buttons.append({"type": "URL", "text": b.text, "url": b.url})
        elif b.type == "PHONE_NUMBER":
            if not b.phone_number:
                raise HTTPException(400, f"Botão telefone '{b.text}' precisa de um número")
            out_buttons.append({"type": "PHONE_NUMBER", "text": b.text, "phone_number": b.phone_number})

    return {"type": "BUTTONS", "buttons": out_buttons}


@router.post("/templates")
async def create_template(data: TemplateCreate, current_user=Depends(get_current_user)):
    """Cria novo template na Meta e envia para aprovação."""
    ch = _resolve_channel(data.channel)

    components = []

    if data.header_text:
        components.append({"type": "HEADER", "format": "TEXT", "text": data.header_text})

    body_params = re.findall(r"\{\{\d+\}\}", data.body)
    body_component: dict = {"type": "BODY", "text": data.body}
    if body_params:
        body_component["example"] = {"body_text": [["exemplo"] * len(body_params)]}
    components.append(body_component)

    if data.footer_text:
        components.append({"type": "FOOTER", "text": data.footer_text})

    if data.buttons:
        buttons_component = _validate_buttons(data.buttons)
        if buttons_component:
            components.append(buttons_component)

    payload = {
        "name": data.name,
        "category": data.category,
        "language": data.language,
        "components": components,
    }

    url = f"https://graph.facebook.com/v22.0/{ch.waba_id}/message_templates"
    headers = {
        "Authorization": f"Bearer {ch.token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=payload, headers=headers)
        result = r.json()

    if "error" in result:
        raise HTTPException(400, result["error"].get("message", "Erro ao criar template"))

    return {
        "status": "created",
        "id": result.get("id"),
        "name": data.name,
        "message": "Template enviado para aprovação da Meta. Pode levar de minutos a 24h.",
    }


# ============================================================
# DELETE /templates/{name}
# ============================================================

@router.delete("/templates/{template_name}")
async def delete_template(
    template_name: str,
    channel: str = Query("cs"),
    current_user=Depends(get_current_user),
):
    """Deleta template da Meta no WABA do canal especificado."""
    ch = _resolve_channel(channel)

    url = f"https://graph.facebook.com/v22.0/{ch.waba_id}/message_templates"
    headers = {"Authorization": f"Bearer {ch.token}"}
    params = {"name": template_name}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.delete(url, headers=headers, params=params)
        result = r.json()

    if "error" in result:
        raise HTTPException(400, result["error"].get("message", "Erro ao deletar template"))

    return {"status": "deleted", "name": template_name, "channel": channel}


# ============================================================
# GET /channels
# ============================================================

@router.get("/channels")
async def list_channels(current_user=Depends(get_current_user)):
    """Lista canais WhatsApp configurados."""
    from app.core.whatsapp_channels import get_configured_channels
    return [
        {"slug": ch.slug, "name": ch.name}
        for ch in get_configured_channels()
    ]
