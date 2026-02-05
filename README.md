# CENAT CS Platform — Sistema de Retenção de Alunos

## Visão Geral
Plataforma de Customer Success para instituições de ensino. Integra dados acadêmicos (Moodle), financeiros (ASAAS) e comunicação (WhatsApp Meta Cloud API) para monitorar, engajar e reter alunos de forma proativa.

```
[Moodle]  ──▶  Alunos, Cursos, Progresso, Notas, Último Acesso
[ASAAS]   ──▶  Cobranças, Status Financeiro, CPF, Telefone
[WhatsApp Meta Cloud API]  ◀──▶  Comunicação bidirecional com alunos
                    │
                    ▼
          ┌─────────────────────┐
          │   CENAT CS Platform │
          │                     │
          │  FastAPI + Next.js  │
          │  PostgreSQL + Redis │
          └─────────────────────┘
                    │
                    ▼
    [Dashboard] [Tickets] [Kanban] [Automações]
    [Risco]     [NPS]     [Financeiro] [WhatsApp]
```

---

## Stack

### Backend
| Tecnologia | Versão | Uso |
|---|---|---|
| **FastAPI** | 0.100+ | API REST assíncrona |
| **PostgreSQL** | 16 | Banco de dados principal |
| **SQLAlchemy** | 2.0+ | ORM |
| **Alembic** | latest | Migrations |
| **Redis** | 7+ | Cache e filas |
| **httpx** | latest | HTTP client assíncrono |
| **Pydantic** | 2.0+ | Validação de dados |
| **python-dotenv** | latest | Variáveis de ambiente |
| **passlib[bcrypt]** | latest | Hash de senhas |
| **python-jose** | latest | JWT tokens |

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| **Next.js** | 14+ | Framework React (App Router) |
| **TypeScript** | 5+ | Tipagem estática |
| **Tailwind CSS** | 3+ | Estilização utility-first |
| **Lucide React** | latest | Ícones |
| **Axios** | latest | HTTP client |
| **Sonner** | latest | Notificações toast |
| **@dnd-kit** | core + utilities | Drag and drop (Kanban) |

### Integrações
| Serviço | Uso |
|---|---|
| **Moodle** | Alunos, cursos, progresso, notas, último acesso |
| **ASAAS** | Cobranças, status financeiro, CPF |
| **WhatsApp Meta Cloud API** | Envio/recebimento de mensagens |

---

## Estrutura do Projeto

```
cenat-cs-platform/
├── apps/
│   ├── api/                          # Backend FastAPI
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── routes/
│   │   │   │   │   ├── auth.py           # Login, registro, /me
│   │   │   │   │   ├── tickets.py        # CRUD tickets + status
│   │   │   │   │   ├── students.py       # CRUD alunos
│   │   │   │   │   ├── courses.py        # Cursos do Moodle
│   │   │   │   │   ├── risk.py           # Score de risco
│   │   │   │   │   ├── feedback.py       # NPS/CSAT
│   │   │   │   │   ├── metrics.py        # Dashboard métricas
│   │   │   │   │   ├── moodle.py         # Sync Moodle + sinais
│   │   │   │   │   ├── asaas.py          # Sync financeiro ASAAS
│   │   │   │   │   ├── automations.py    # Motor de automações
│   │   │   │   │   ├── conversations.py  # Multiatendimento WhatsApp
│   │   │   │   │   ├── playbooks.py      # Playbooks de ação
│   │   │   │   │   ├── triggers.py       # Triggers automáticos
│   │   │   │   │   └── webhooks.py       # Webhook Meta WhatsApp
│   │   │   │   └── deps.py
│   │   │   ├── core/
│   │   │   │   ├── deps.py               # get_db, get_current_user
│   │   │   │   └── security.py           # JWT, hashing
│   │   │   ├── db/
│   │   │   │   ├── session.py            # SessionLocal, engine
│   │   │   │   └── migrations/           # Alembic migrations
│   │   │   ├── integrations/
│   │   │   │   ├── moodle.py             # Client Moodle API
│   │   │   │   └── whatsapp_meta.py      # Client Meta Cloud API
│   │   │   ├── jobs/
│   │   │   │   ├── sync_students.py      # Sync alunos do Moodle
│   │   │   │   └── sync_moodle_signals.py # Captura sinais acadêmicos
│   │   │   ├── models/
│   │   │   │   ├── user.py               # Usuários do sistema
│   │   │   │   ├── student.py            # Alunos
│   │   │   │   ├── course.py             # Cursos
│   │   │   │   ├── enrollment.py         # Matrículas
│   │   │   │   ├── ticket.py             # Tickets de atendimento
│   │   │   │   ├── ticket_message.py     # Mensagens dos tickets
│   │   │   │   ├── moodle_signal.py      # Sinais acadêmicos
│   │   │   │   ├── risk_score.py         # Score de risco
│   │   │   │   ├── feedback.py           # NPS/CSAT
│   │   │   │   ├── automation.py         # Automações
│   │   │   │   ├── playbook.py           # Playbooks
│   │   │   │   ├── trigger.py            # Triggers
│   │   │   │   └── conversation.py       # Conversas WhatsApp
│   │   │   └── services/
│   │   │       ├── risk_service.py       # Cálculo de risco
│   │   │       ├── ticket_service.py     # Lógica de tickets
│   │   │       ├── asaas_service.py      # Client ASAAS API
│   │   │       ├── automation_service.py # Motor de automações
│   │   │       ├── conversation_service.py # Lógica de conversas
│   │   │       ├── trigger_service.py    # Lógica de triggers
│   │   │       └── feedback_service.py   # Lógica de NPS
│   │   ├── .env                          # Variáveis de ambiente
│   │   ├── alembic.ini
│   │   └── requirements.txt
│   │
│   └── web/                          # Frontend Next.js
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── login/page.tsx
│           │   ├── dashboard/page.tsx
│           │   ├── students/page.tsx
│           │   ├── tickets/
│           │   │   ├── page.tsx          # Lista
│           │   │   └── kanban/page.tsx   # Kanban drag-and-drop
│           │   ├── risk/[id]/page.tsx
│           │   ├── automations/
│           │   │   ├── page.tsx
│           │   │   └── [id]/page.tsx
│           │   ├── conversations/page.tsx
│           │   ├── financial/page.tsx
│           │   ├── feedback/page.tsx
│           │   ├── metrics/page.tsx
│           │   └── courses/page.tsx
│           ├── components/
│           │   ├── AppLayout.tsx
│           │   └── Sidebar.tsx
│           ├── contexts/
│           │   └── auth-context.tsx
│           └── lib/
│               └── api.ts
```

---

## Funcionalidades

### 1. Dashboard
- KPIs em tempo real: total alunos, tickets abertos, risco médio, NPS
- Gráficos de evolução
- Resumo rápido das pendências

### 2. Gestão de Alunos
- 1.131 alunos sincronizados do Moodle
- Dados enriquecidos com CPF e telefone do ASAAS
- Busca por nome, email, status Moodle
- Filtros: vinculados/não vinculados ao Moodle

### 3. Tickets de Atendimento
- **Lista**: tabela com busca, filtros por status/prioridade/categoria
- **Kanban**: drag-and-drop entre colunas (Aberto → Em Andamento → Aguardando → Resolvido)
- Protocolo automático
- Atribuição de responsável
- SLA tracking
- Criação automática via WhatsApp

### 4. Score de Risco
Cálculo ponderado com 6 indicadores:

| Indicador | Peso | Fonte | Lógica |
|---|---|---|---|
| Engajamento | 25% | Moodle | Dias sem acesso (0-30 dias → 0-100) |
| Progresso | 25% | Moodle | Nota do curso normalizada (invertida) |
| Notas | 15% | Moodle | Nota mais baixa (invertida) |
| Financeiro | 15% | ASAAS | em_dia=0, pendente=40, inadimplente=100 |
| Tickets | 10% | Sistema | Tickets abertos + reclamações |
| NPS/CSAT | 10% | Sistema | Promotor=0, Neutro=40, Detrator=100 |

**Níveis:** Crítico (≥75), Alto (≥50), Médio (≥25), Baixo (<25)

**Regra sem dado:** quando não há informação, o score é 0 (sem risco), evitando inflação artificial.

### 5. Integração Financeira (ASAAS)
- 1.038 alunos vinculados por email
- Status financeiro: em dia (275), pendente (549), inadimplente (211)
- R$ 203.657,69 em atraso mapeados
- Página dedicada com filtros, busca por CPF, modal de cobranças
- Sync automático de CPF e telefone
- Botões: "Vincular Alunos" e "Atualizar Financeiro"

### 6. Motor de Automações
- Scheduler rodando a cada 30 minutos
- **Triggers**: days_without_access, inactive_student, days_after_enrollment, nps_response, first_login
- **Ações**: send_whatsapp, create_ticket
- **Template variables**: {name}, {email}, {phone}, {days}, {course}
- Cooldown de 24h entre execuções por aluno
- Página de detalhe com métricas e logs de execução

### 7. Multiatendimento WhatsApp
- Integração com **Meta Cloud API oficial**
- Webhook para receber mensagens em tempo real
- Conversas organizadas por contato
- Badge de mensagens não lidas (auto-refresh 15s)
- Envio de mensagens de texto
- Envio de templates aprovados pela Meta
- Marcação automática de leitura
- Suporte a tipos: texto, imagem, áudio, vídeo, documento, localização, figurinha

### 8. NPS/CSAT
- Envio de pesquisas por WhatsApp
- Coleta de score e comentários
- Integração com score de risco

### 9. Sinais do Moodle
- Captura diária de sinais acadêmicos por aluno/curso
- Dados capturados: último acesso, notas, progresso (baseado em notas)
- 1.270 sinais capturados, 1.118 com notas reais
- Endpoint manual: `POST /api/moodle/sync-signals`

---

## Variáveis de Ambiente (`.env`)

```env
# Banco de Dados
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/cenat_cs

# JWT
SECRET_KEY=sua-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Moodle
MOODLE_URL=https://seu-moodle.com
MOODLE_TOKEN=seu-token-moodle

# ASAAS
ASAAS_API_KEY=sua-chave-asaas
ASAAS_BASE_URL=https://api.asaas.com/v3

# WhatsApp Meta Cloud API
WHATSAPP_TOKEN=seu-token-permanente
WHATSAPP_PHONE_NUMBER_ID=seu-phone-number-id
WHATSAPP_WABA_ID=seu-waba-id
WEBHOOK_VERIFY_TOKEN=cenat_webhook_2024

# Redis
REDIS_URL=redis://localhost:6379/0
```

---

## Instalação e Execução

### Pré-requisitos
- Python 3.11+
- Node.js 18+
- Docker (para PostgreSQL)
- Conta Meta Business verificada (para WhatsApp)

### 1. Banco de Dados
```bash
docker run -d --name cenat-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=cenat_cs \
  -p 5434:5432 \
  postgres:16
```

### 2. Backend
```bash
cd apps/api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend
```bash
cd apps/web
npm install
npm run dev
```

### 4. Criar Admin
```bash
cd apps/api && source venv/bin/activate
python3 -c "
from app.db.session import SessionLocal
from app.models.user import User
from passlib.context import CryptContext
pwd = CryptContext(schemes=['bcrypt'])
db = SessionLocal()
user = User(name='Administrador', email='admin@cenat.com', hashed_password=pwd.hash('admin123'), role='admin', is_active=True)
db.add(user)
db.commit()
print('Admin criado')
"
```

### 5. Sync Inicial
```bash
# Login e sync alunos
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cenat.com","password":"admin123"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

# Sync Moodle
curl -s -X POST http://localhost:8000/api/moodle/sync-students \
  -H "Authorization: Bearer $TOKEN"

# Sync ASAAS (clientes)
curl -s -X POST http://localhost:8000/api/asaas/sync-customers \
  -H "Authorization: Bearer $TOKEN"

# Sync ASAAS (financeiro)
curl -s -X POST http://localhost:8000/api/asaas/sync-financial \
  -H "Authorization: Bearer $TOKEN"

# Captura sinais Moodle
curl -s -X POST http://localhost:8000/api/moodle/sync-signals \
  -H "Authorization: Bearer $TOKEN"
```

---

## Configuração do Webhook WhatsApp (Meta)

1. Acesse **developers.facebook.com** → seu app → **WhatsApp** → **Configuração**
2. Configure a URL do webhook: `https://seu-dominio.com/api/webhook/whatsapp`
3. Verify Token: `cenat_webhook_2024`
4. Assine os campos: `messages`

---

## API Endpoints Principais

### Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login (retorna JWT) |
| GET | `/api/auth/me` | Dados do usuário logado |

### Alunos
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/students` | Lista alunos |
| GET | `/api/students/{id}` | Detalhe do aluno |

### Tickets
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tickets` | Lista tickets |
| POST | `/api/tickets` | Criar ticket |
| PATCH | `/api/tickets/{id}/status?status=X` | Mudar status |

### Moodle
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/moodle/sync-students` | Sync alunos |
| POST | `/api/moodle/sync-signals` | Captura sinais acadêmicos |

### ASAAS
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/asaas/sync-customers` | Vincula clientes por email |
| POST | `/api/asaas/sync-financial` | Atualiza status financeiro |
| GET | `/api/asaas/student/{id}/payments` | Cobranças do aluno |

### Automações
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/automations` | Lista automações |
| POST | `/api/automations` | Criar automação |
| POST | `/api/automations/run` | Executar todas agora |

### Conversas
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conversations` | Lista conversas |
| GET | `/api/conversations/{id}/messages` | Mensagens da conversa |
| POST | `/api/conversations/{id}/messages` | Enviar mensagem |

### Webhook
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/webhook/whatsapp` | Verificação Meta |
| POST | `/api/webhook/whatsapp` | Recebe mensagens WhatsApp |

---

## Acesso

| Item | Valor |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Admin | admin@cenat.com / admin123 |
| Banco | postgresql://postgres:postgres@127.0.0.1:5434/cenat_cs |

---

## Equipe
- **Coordenador Pedagógico:** Thiago
- **CS/Secretaria:** Luiza
- **Operacional Pedagógico:** Camila

---

## Reinicialização do Sistema

Após reiniciar o computador:
```bash
# 1. PostgreSQL
docker start cenat-postgres

# 2. Backend
cd ~/Documents/cenat-cs-platform/apps/api
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 3. Frontend (outro terminal)
cd ~/Documents/cenat-cs-platform/apps/web
npm run dev
```

---

## Pendências
- [ ] Configurar webhook Meta em produção (ngrok para dev)
- [ ] Criar templates WhatsApp aprovados pela Meta
- [ ] Serviço de e-mail (SendGrid/SMTP)
- [ ] Classificação automática de tickets
- [ ] Botão WhatsApp nas páginas de alunos/risco/financeiro
- [ ] Deploy produção