import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx

from app.core.deps import get_current_user
from app.core.whatsapp_channels import get_channel

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/templates")
async def list_templates(current_user=Depends(get_current_user)):
    """Lista templates da Meta Cloud API (todos os status)"""
    channel = get_channel("cs")
    if not channel or not channel.is_configured:
        return []

    url = f"https://graph.facebook.com/v22.0/{channel.waba_id}/message_templates"
    headers = {"Authorization": f"Bearer {channel.token}"}
    params = {"limit": 100}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=headers, params=params)
        data = r.json()

    if "error" in data:
        raise HTTPException(400, data["error"].get("message", "Erro ao buscar templates"))

    templates = []
    for t in data.get("data", []):
        body_text = ""
        param_count = 0
        for comp in t.get("components", []):
            if comp.get("type") == "BODY":
                body_text = comp.get("text", "")
                param_count = len(re.findall(r'\{\{\d+\}\}', body_text))

        templates.append({
            "id": t.get("id"),
            "name": t["name"],
            "language": t.get("language", "pt_BR"),
            "status": t.get("status", "UNKNOWN"),
            "category": t.get("category", ""),
            "body": body_text,
            "param_count": param_count,
        })

    # Ordena: aprovados primeiro, depois por nome
    status_order = {"APPROVED": 0, "PENDING": 1, "REJECTED": 2}
    templates.sort(key=lambda t: (status_order.get(t["status"], 9), t["name"]))

    return templates


class TemplateCreate(BaseModel):
    name: str
    category: str = "MARKETING"
    language: str = "pt_BR"
    body: str
    header_text: Optional[str] = None
    footer_text: Optional[str] = None


@router.post("/templates")
async def create_template(data: TemplateCreate, current_user=Depends(get_current_user)):
    """Cria novo template na Meta e envia para aprovação"""
    channel = get_channel("cs")
    if not channel or not channel.is_configured:
        raise HTTPException(400, "Canal WhatsApp não configurado")

    # Monta components
    components = []

    if data.header_text:
        components.append({
            "type": "HEADER",
            "format": "TEXT",
            "text": data.header_text,
        })

    # Body com exemplos para os parâmetros
    body_params = re.findall(r'\{\{\d+\}\}', data.body)
    body_component = {
        "type": "BODY",
        "text": data.body,
    }
    if body_params:
        body_component["example"] = {
            "body_text": [["exemplo"] * len(body_params)]
        }
    components.append(body_component)

    if data.footer_text:
        components.append({
            "type": "FOOTER",
            "text": data.footer_text,
        })

    payload = {
        "name": data.name,
        "category": data.category,
        "language": data.language,
        "components": components,
    }

    url = f"https://graph.facebook.com/v22.0/{channel.waba_id}/message_templates"
    headers = {
        "Authorization": f"Bearer {channel.token}",
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


@router.delete("/templates/{template_name}")
async def delete_template(template_name: str, current_user=Depends(get_current_user)):
    """Deleta template da Meta"""
    channel = get_channel("cs")
    if not channel or not channel.is_configured:
        raise HTTPException(400, "Canal WhatsApp não configurado")

    url = f"https://graph.facebook.com/v22.0/{channel.waba_id}/message_templates"
    headers = {"Authorization": f"Bearer {channel.token}"}
    params = {"name": template_name}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.delete(url, headers=headers, params=params)
        result = r.json()

    if "error" in result:
        raise HTTPException(400, result["error"].get("message", "Erro ao deletar template"))

    return {"status": "deleted", "name": template_name}