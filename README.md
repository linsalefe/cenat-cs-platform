# WhatsApp AI Agent v2.0 — Documentação

## Visão Geral
Atendente de WhatsApp com IA (OpenAI + RAG simples) orquestrado por uma API FastAPI.  
Recebe mensagens via **Mega API** (webhook), gera respostas com IA usando contexto local (`data/`), e responde pelo endpoint **/text** da Mega.

```
[Usuário WhatsApp]
      │
      ▼
[Mega API] ──▶ POST {PUBLIC_URL}/webhook ──▶ FastAPI (process_and_reply)
                                   └──▶ OpenAI (gpt-4o-mini) + RAG (data/*.txt)
                                   └──▶ Mega /rest/sendMessage/{INSTANCE}/text
                                   └──▶ [Usuário WhatsApp]
```

---

## Stack
- **Python 3.11**
- **FastAPI** (API REST)
- **OpenAI SDK v1** (chat.completions)
- **httpx** (HTTP assíncrono)
- **loguru** (logs)
- **python-dotenv** (carregar `.env`)
- **ngrok** (expor API local para a Mega)
- **Mega API** (recebimento e envio WhatsApp)

---

## Estrutura do Projeto
```
sales-agents-n8n-langchain-rd/
├─ agents/
│  ├─ __init__.py
│  ├─ conversation_agent.py
│  ├─ sdr_whatsapp.py
│  └─ simple_rag.py
├─ api/
│  ├─ __pycache__/
│  ├─ __init__.py
│  ├─ main.py               # <— arquivo principal (webhook, IA, anti-loop, Mega)
│  ├─ models.py
│  ├─ settings.py
│  ├─ requirements.txt
│  └─ tests/                # (quando aplicável)
├─ data/
│  ├─ empresas/
│  │  └─ cenat.txt
│  └─ produtos/
│     ├─ bpsm.txt
│     ├─ congresso.txt
│     └─ produtos.txt
├─ scripts/
├─ venv/
├─ .env                     # <— suas chaves locais (NÃO commitar)
├─ .env.example
├─ .gitignore
└─ README.md
```

---

## Como Funciona (Fluxo)
1. **Recebimento**: a Mega chama `POST {PUBLIC_URL}/webhook` com eventos/mensagens do WhatsApp.
2. **Normalização**: o webhook extrai `remoteJid` (telefone) e o **texto** da mensagem (suporta `conversation`, `extendedTextMessage.text`, `image/document/video.caption`, mensagens efêmeras).
3. **Anti-loop & Dedupe**:
   - Ignora mensagens com `fromMe=True` (eco do próprio número).
   - Bloqueia **eco** do último texto enviado pelo bot por `DEDUP_TTL` segundos.
   - Deduplica duplicatas pelo par `(phone+texto)` na mesma janela.
   - Usa **lock por contato** ao enviar para evitar corrida.
4. **IA**: gera resposta com **OpenAI** (ou modo **DRY_RUN**), usando contexto RAG carregado de `data/*.txt`.
5. **Envio**: responde via Mega em `POST /rest/sendMessage/{INSTANCE}/text` com:
   ```json
   { "messageData": { "to": "5583...@s.whatsapp.net", "text": "..." } }
   ```

---

## Endpoints

### `GET /health`
Retorna status de execução e flags.
Exemplo:
```json
{
  "status": "ok",
  "version": "2.0",
  "ai_mode": "REAL",
  "context_loaded": true,
  "mega_configured": true,
  "debug": {
    "ai_dry_run_env": "0",
    "mega_token_present": true,
    "openai_key_present": true,
    "ignore_from_me": true,
    "dedup_ttl": 12.0
  }
}
```

### `POST /webhook`
- **Uso**: chamado pela Mega com eventos de mensagens.
- **Comportamento**: tolera formatos diferentes; ignora eventos sem texto/telefone; aplica anti-eco/dedupe.

### `POST /send-message`
Envio manual de teste.
Body:
```json
{ "phone": "5583988046720", "message": "Olá! Teste" }
```

### `GET /mega-status`
Consulta status da instância (QR, conectada, etc.) na Mega.

---

## Variáveis de Ambiente (`.env`)
```env
# OpenAI
OPENAI_API_KEY=...
MODEL_NAME=gpt-4o-mini
AI_DRY_RUN=0          # 1: não chama OpenAI (resposta dummy); 0: usa OpenAI

# API
API_HOST=0.0.0.0
API_PORT=8000

# Mega API
MEGA_API_BASE_URL=https://apistart01.megaapi.com.br
MEGA_API_TOKEN=...
MEGA_INSTANCE_ID=megastart-...

# Comportamento do webhook
IGNORE_FROM_ME=1      # ignora ecos do próprio número (recomendado em produção)
DEDUP_TTL=12          # janela anti-eco/duplicatas (segundos)
```

> **Segurança**: não commitar `.env`. Rotacione chaves que já foram expostas.

---

## Subindo Localmente
1) (Opcional) criar venv e instalar:
```bash
python -m venv venv
source venv/bin/activate
pip install -r api/requirements.txt
```

2) Rodar a API:
```bash
python -m uvicorn api.main:app --reload
```

3) Expor com ngrok:
```bash
ngrok http --region sa 8000
# copie a URL https://XXXX.ngrok-free.app
```

4) Configurar **Webhook** no painel da Mega:
```
https://XXXX.ngrok-free.app/webhook
```

5) Testes rápidos:
```bash
# Health
curl -s https://XXXX.ngrok-free.app/health

# Simular evento de mensagem (como a Mega faria)
curl -s -X POST "https://XXXX.ngrok-free.app/webhook"   -H "Content-Type: application/json"   -d '{
    "messageType":"notification",
    "key":{"fromMe":false,"remoteJid":"5583988046720@s.whatsapp.net"},
    "pushName":"Teste",
    "message":{"conversation":"Qual o preço do curso?"}
  }'
```

---

## RAG (Contexto)
- Arquivos `.txt` em `data/empresas/*.txt` e `data/produtos/*.txt`.
- O conteúdo é carregado na inicialização e passado ao prompt da IA.
- **Boas práticas**:
  - Títulos claros nos arquivos.
  - Informação objetiva (preços, datas, locais, diferenciais).
  - Atualize `data/` e reinicie a API para refletir.

---

## Mega API (Envio)
- Endpoint de envio **correto**:  
  `POST {MEGA_API_BASE_URL}/rest/sendMessage/{MEGA_INSTANCE_ID}/text`
- Body:
```json
{ "messageData": { "to": "55DDDNNNNNNN@s.whatsapp.net", "text": "sua mensagem" } }
```
- Erro **404**? Geralmente é endpoint errado (faltou `/text`).
- Erro por **JID**? Garanta `@s.whatsapp.net` no `to`.

---

## Anti-loop / Anti-eco / Dedupe
- `IGNORE_FROM_ME=1`: mensagens marcadas `fromMe=True` **não** entram no fluxo.
- Se, ainda assim, um provedor ecoar um texto idêntico:
  - O último envio do bot é guardado por `DEDUP_TTL` s e a mensagem idêntica é ignorada.
- Deduplicação por `(phone+texto)` na mesma janela de tempo.
- **Lock por contato** evita múltiplos envios simultâneos para o mesmo número.

---

## Observabilidade & Debug
- **Logs** (loguru): mostram quem chamou o webhook, `fromMe`, `jid`, e o texto.
- **ngrok inspector**: `http://127.0.0.1:4040` (veja se a Mega realmente chama `/webhook`).
- **/health**: conferir flags e configuração de ambiente.
- **/mega-status**: validar conexão/QR da instância.

---

## Erros comuns & Soluções
- **ERR_NGROK_3200 / página HTML do ngrok**: túnel offline. Rode `ngrok http 8000` e atualize o webhook na Mega.
- **Webhook sem `/webhook`**: a Mega chama a raiz e você não recebe nada. Corrija a URL.
- **404 ao enviar**: faltou `/text` no endpoint da Mega.
- **422 no `/webhook`**: eventos de status sem corpo esperado. O webhook atual já é tolerante; devolve 200 e ignora.
- **Loop de mensagens**: `fromMe=True` não ignorado, ou eco do texto. Use `IGNORE_FROM_ME=1` e mantenha o `DEDUP_TTL`.

---

## Produção (opções)
- **Ngrok (rápido)**: bom para POC/validação.
- **VPS + Nginx + HTTPS**:
  - `uvicorn api.main:app --host 0.0.0.0 --port 8000`
  - Proxy reverso Nginx com certificado (Let’s Encrypt) e apontar Mega para `https://seu-dominio/webhook`.
- **Docker**:
  - `Dockerfile` e/ou `docker-compose.yml` opcionais no projeto para empacotar a API.

---

## Roadmap
- Painel simples (Streamlit/Next) para:
  - Ligar/desligar `AI_DRY_RUN`, `IGNORE_FROM_ME`, `DEDUP_TTL`.
  - Visualizar últimos envios e contexto carregado.
- Persistir conversas em BD (SQLite/Postgres).
- Melhorar RAG (embeddings + vetor, filtros por produto/empresa).
- Observabilidade (request-id, correlação, métricas Prometheus).
