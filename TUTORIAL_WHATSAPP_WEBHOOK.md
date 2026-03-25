# Tutorial Técnico: Resolver Problemas de Webhook WhatsApp Meta Cloud API

## O Problema

Você tem um número WhatsApp Business configurado na Meta Cloud API, mas mensagens enviadas pelos usuários não chegam no seu servidor (webhook não dispara). O envio via API pode funcionar, mas o recebimento não.

---

## Diagnóstico Rápido (5 minutos)

Execute esses 4 passos na ordem. Pare no primeiro que falhar.

### Passo 1: Testar se o endpoint responde

```bash
curl -s "https://SEU_DOMINIO/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste123"
```

**Esperado:** retornar `teste123`
**Se falhar:** problema no servidor (Nginx, rota não existe, certificado SSL)

### Passo 2: Verificar qual app é dono do número

```bash
curl -s "https://graph.facebook.com/v22.0/PHONE_NUMBER_ID?fields=webhook_configuration&access_token=TOKEN" | python3 -m json.tool
```

**Atenção ao campo `webhook_configuration`:**
- Se `"application": "https://seu-servidor/webhook"` → app correto, webhook OK
- Se `"application": "https://OUTRO-servidor/webhook"` → **OUTRO APP** controla os webhooks
- Se aparece `"whatsapp_business_account": "https://..."` → tem override de WABA

### Passo 3: Verificar inscrição do WABA

```bash
curl -s "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps?access_token=TOKEN" | python3 -m json.tool
```

**Verificar:**
- O app correto está listado?
- Tem `override_callback_uri`? Se sim, o webhook vai para lá em vez do webhook padrão do app

### Passo 4: Verificar se o número está registrado

```bash
curl -s "https://graph.facebook.com/v22.0/PHONE_NUMBER_ID?fields=code_verification_status,platform_type,quality_rating&access_token=TOKEN" | python3 -m json.tool
```

**Se `code_verification_status: EXPIRED`:** precisa re-registrar:
```bash
curl -s -X POST "https://graph.facebook.com/v22.0/PHONE_NUMBER_ID/register" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"SEU_PIN_6_DIGITOS"}'
```

---

## Causas Raiz Mais Comuns

### 1. Número pertence a app diferente do webhook

**Sintoma:** Webhook configurado no app A, mas o número foi adicionado ao app B.

**Diagnóstico:**
```bash
# Ver qual app controla o número
curl -s "https://graph.facebook.com/v22.0/PHONE_NUMBER_ID?fields=webhook_configuration&access_token=TOKEN"
```

**Solução:** Configurar o webhook no app que é DONO do número, não em outro app.

### 2. Número em WABA diferente

**Sintoma:** Números no mesmo app mas em WABAs diferentes. Um recebe webhook, outro não.

**Diagnóstico:**
```bash
# Ver apps inscritos no WABA
curl -s "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps?access_token=TOKEN"
```

**Solução:** Inscrever o app em TODOS os WABAs que têm números:
```bash
curl -s -X POST "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Override de webhook no nível do WABA ou número

**Sintoma:** A Meta mandou `subscribed_apps` com `override_callback_uri` apontando para URL errada.

**Diagnóstico:**
```bash
curl -s "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps?access_token=TOKEN"
# Procurar por: "override_callback_uri": "https://..."
```

**Solução — Remover override:**
```bash
# Deletar inscrição
curl -s -X DELETE "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer TOKEN"

# Reinscrever sem override
curl -s -X POST "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Campo `messages` não assinado no webhook

**Sintoma:** Webhook configurado, mas o campo messages não está ativo.

**Solução:** Meta Developers → App → WhatsApp → Configuração → Role até "messages" → Ative o toggle (deve ficar azul "Assinado")

### 5. App em modo Development (não Live)

**Sintoma:** Tudo parece certo mas webhooks não chegam.

**Solução:** Meta Developers → App → topo da página → Toggle "Modo do app" → mudar para "Ao vivo" (Live)

### 6. Número desregistrado após migração entre WABAs

**Sintoma:** Número foi migrado entre WABAs e parou de funcionar.

**Solução — Re-registrar:**
```bash
curl -s -X POST "https://graph.facebook.com/v22.0/PHONE_NUMBER_ID/register" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"SEU_PIN"}'
```

**Erro de PIN:** Se não souber o PIN, tente `000000` ou `123456`. Se nenhum funcionar, resete pela Meta:
- Meta Business Manager → Gerenciador do WhatsApp → Número → Verificação em duas etapas → Resetar

### 7. Forma de pagamento ausente

**Sintoma:** API retorna `"message_status": "accepted"` mas mensagem não é entregue. Webhooks não disparam.

**Solução:** Meta Business Manager → Configurações do negócio → Cobrança e pagamentos → Contas → Adicionar forma de pagamento ao WABA correto.

### 8. Token de app deletado/inválido

**Sintoma:** `"Application has been deleted"` ou `"Session has expired"`

**Solução:** Gerar novo token permanente:
1. business.facebook.com → Configurações do negócio
2. Contas do sistema → Selecionar usuário
3. Gerar token → App correto → Permissões: `whatsapp_business_messaging` + `whatsapp_business_management`

---

## Solução: Relay entre Servidores (quando não pode mudar o webhook)

Se o webhook pertence a outro sistema e não pode ser alterado, use um **relay** no código do servidor que já recebe os webhooks.

### No FastAPI do servidor que recebe:

```python
import httpx

@app.post("/webhook")
async def receive_webhook(request: Request):
    body = await request.json()

    # Relay para outro servidor
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                "https://outro-servidor.com/api/webhook/whatsapp",
                json=body
            )
    except Exception as e:
        print(f"Relay falhou: {e}")

    # Continua processamento normal...
```

**Requisitos:**
- `httpx` instalado no ambiente (`pip install httpx`)
- O servidor destino precisa aceitar POST em `/api/webhook/whatsapp`
- O servidor destino precisa processar o mesmo formato de payload da Meta

### No Nginx (alternativa - mirror):

```nginx
location /webhook {
    mirror /mirror_webhook;
    mirror_request_body on;
    proxy_pass http://127.0.0.1:8001/webhook;
    proxy_set_header Host $host;
}

location = /mirror_webhook {
    internal;
    resolver 8.8.8.8;
    proxy_pass https://outro-servidor.com/api/webhook/whatsapp;
    proxy_set_header Host outro-servidor.com;
    proxy_set_header Content-Type application/json;
}
```

**Nota:** O mirror do Nginx pode não funcionar em todos os cenários (problemas de DNS, SSL). O relay no código é mais confiável.

---

## Migrar Número entre WABAs

Se precisar mover um número de um WABA para outro:

```bash
curl -s -X POST "https://graph.facebook.com/v22.0/WABA_DESTINO_ID/phone_numbers" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cc":"55","phone_number":"NUMERO_SEM_55","migrate_phone_number":true}'
```

**Retorno:** Novo `phone_number_id` (o antigo deixa de funcionar)

**Após migração, SEMPRE re-registrar:**
```bash
curl -s -X POST "https://graph.facebook.com/v22.0/NOVO_PHONE_NUMBER_ID/register" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"SEU_PIN"}'
```

**ATENÇÃO:**
- Templates NÃO migram entre WABAs — precisam ser recriados
- O Phone Number ID MUDA após migração — atualize no `.env`
- Se der erro de certificado/propriedade, pode ser necessário verificar o número novamente

---

## Checklist de Verificação (copie e use)

```
[ ] Endpoint responde ao GET de verificação?
[ ] App está em modo LIVE?
[ ] Campo "messages" está ASSINADO no webhook?
[ ] O número pertence ao MESMO app do webhook?
[ ] O WABA do número tem o app inscrito?
[ ] Não tem override_callback_uri apontando para lugar errado?
[ ] O número está registrado (não expired)?
[ ] O token é do app correto (não deletado)?
[ ] WABA tem forma de pagamento?
[ ] PIN de verificação em 2 etapas é conhecido?
```

---

## Comandos Úteis

```bash
# Ver info do número
curl -s "https://graph.facebook.com/v22.0/PHONE_ID?fields=webhook_configuration,code_verification_status,platform_type,quality_rating,display_phone_number&access_token=TOKEN" | python3 -m json.tool

# Ver apps inscritos no WABA
curl -s "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps?access_token=TOKEN" | python3 -m json.tool

# Testar envio de template
curl -s -X POST "https://graph.facebook.com/v22.0/PHONE_ID/messages" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"DESTINO_COM_55","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}'

# Testar envio de texto (só funciona dentro da janela de 24h)
curl -s -X POST "https://graph.facebook.com/v22.0/PHONE_ID/messages" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"DESTINO_COM_55","type":"text","text":{"body":"Teste"}}'

# Registrar número
curl -s -X POST "https://graph.facebook.com/v22.0/PHONE_ID/register" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"123456"}'

# Inscrever app no WABA
curl -s -X POST "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"

# Remover inscrição
curl -s -X DELETE "https://graph.facebook.com/v22.0/WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer TOKEN"
```
