# CENAT CS Platform — Sistema de Retenção de Alunos

## Visão Geral
Plataforma de Customer Success para instituições de ensino. Integra dados acadêmicos (Moodle), financeiros (ASAAS) e comunicação (WhatsApp Meta Cloud API) para monitorar, engajar e reter alunos de forma proativa.
```
[Moodle]  ──▶  Alunos, Cursos, Progresso, Notas, Último Acesso, Documentos
[ASAAS]   ──▶  Cobranças, Status Financeiro, CPF, Telefone
[WhatsApp Meta Cloud API]  ◀──▶  Comunicação bidirecional com alunos (multicanal)
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
    [Onboarding] [Conversas Multicanal]
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
| **Moodle** | Alunos, cursos, progresso, notas, último acesso, documentos de matrícula |
| **ASAAS** | Cobranças, status financeiro, CPF |
| **WhatsApp Meta Cloud API** | Envio/recebimento de mensagens (multicanal) |

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
│   │   │   │   │   ├── students.py       # CRUD alunos + filtros avançados
│   │   │   │   │   ├── courses.py        # Cursos do Moodle
│   │   │   │   │   ├── risk.py           # Score de risco + tendências
│   │   │   │   │   ├── feedback.py       # NPS/CSAT
│   │   │   │   │   ├── metrics.py        # Dashboard métricas
│   │   │   │   │   ├── moodle.py         # Sync Moodle + sinais
│   │   │   │   │   ├── asaas.py          # Sync financeiro ASAAS
│   │   │   │   │   ├── automations.py    # Motor de automações
│   │   │   │   │   ├── conversations.py  # Multiatendimento WhatsApp
│   │   │   │   │   ├── onboarding.py     # Formulário público de cadastro
│   │   │   │   │   ├── playbooks.py      # Playbooks de ação
│   │   │   │   │   ├── triggers.py       # Triggers automáticos
│   │   │   │   │   └── webhooks.py       # Webhook Meta WhatsApp
│   │   │   │   └── deps.py
│   │   │   ├── core/
│   │   │   │   ├── deps.py               # get_db, get_current_user
│   │   │   │   ├── security.py           # JWT, hashing
│   │   │   │   └── whatsapp_channels.py  # Registro de canais WhatsApp
│   │   │   ├── db/
│   │   │   │   ├── session.py            # SessionLocal, engine
│   │   │   │   └── migrations/           # Alembic migrations
│   │   │   ├── integrations/
│   │   │   │   ├── moodle.py             # Client Moodle API (+ firstaccess, customfields)
│   │   │   │   └── whatsapp_meta.py      # Client Meta Cloud API (multicanal)
│   │   │   ├── jobs/
│   │   │   │   ├── sync_students.py      # Sync alunos do Moodle (+ docs, login, curso)
│   │   │   │   └── sync_moodle_signals.py # Captura sinais acadêmicos
│   │   │   ├── models/
│   │   │   │   ├── user.py               # Usuários do sistema
│   │   │   │   ├── student.py            # Alunos (+ first_access, docs, curso)
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
│   │   │   │   └── conversation.py       # Conversas WhatsApp (com canal)
│   │   │   └── services/
│   │   │       ├── risk_service.py       # Cálculo de risco + tendências
│   │   │       ├── ticket_service.py     # Lógica de tickets
│   │   │       ├── asaas_service.py      # Client ASAAS API
│   │   │       ├── automation_service.py # Motor de automações
│   │   │       ├── conversation_service.py # Lógica de conversas (multicanal)
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
│           │   ├── students/page.tsx      # Gestão de alunos + filtros avançados
│           │   ├── tickets/
│           │   │   ├── page.tsx          # Lista
│           │   │   └── kanban/page.tsx   # Kanban drag-and-drop
│           │   ├── risk/
│           │   │   ├── page.tsx          # Dashboard de risco + tendências
│           │   │   └── [id]/page.tsx     # Detalhe do aluno (componentes, presença, histórico)
│           │   ├── automations/
│           │   │   ├── page.tsx
│           │   │   └── [id]/page.tsx
│           │   ├── conversations/page.tsx # Multicanal com abas
│           │   ├── onboarding/page.tsx   # Formulário público
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
- **1.140 alunos** sincronizados do Moodle (24 cursos de pós-graduação)
- Dados enriquecidos com CPF e telefone do ASAAS
- **Filtros avançados server-side**:
  - **Curso**: 24 cursos com contagem de alunos
  - **Login**: Nunca logou (104 alunos) / Já logou
  - **Documentos**: Completos (959) / Parciais / Nenhum enviado (181)
  - **Financeiro**: Em dia / Pendente / Inadimplente
- Busca por nome ou email
- Cards de stats clicáveis (total, nunca logaram, sem docs, inadimplentes)
- Filter pills removíveis com botão "Limpar"
- Paginação server-side
- Ações rápidas: WhatsApp, email, ver detalhes

#### Documentos do Moodle
5 campos customizados de perfil capturados automaticamente:
| Campo | Shortname | Tipo |
|---|---|---|
| CPF | `cpf` | file |
| RG | `rg` | file |
| Histórico Escolar | `historico_escolar` | file |
| Diploma | `diploma` | file |
| Comprovante de Residência | `comprovante_de_residencia` | file |

### 3. Tickets de Atendimento
- **Lista**: tabela com busca, filtros por status/prioridade/categoria
- **Kanban**: drag-and-drop entre colunas (Aberto → Em Andamento → Aguardando → Resolvido)
- Protocolo automático
- Atribuição de responsável
- SLA tracking
- Criação automática via WhatsApp
- **Protocolo enviado apenas na primeira mensagem** (não repete em mensagens subsequentes)
- **Tickets reabrem automaticamente** se o aluno responde dentro de 24h após resolução
- **Ticket novo com protocolo** só é criado se não houver ticket aberto ou se o último foi resolvido há mais de 24h

### 4. Score de Risco (Análise Preditiva)
Cálculo ponderado com 6 indicadores:

| Indicador | Peso | Fonte | Lógica |
|---|---|---|---|
| Engajamento | 25% | Moodle | Dias sem acesso (0-30 dias → 0-100) |
| Presença | 20% | Sistema | Faltas consecutivas e taxa de ausência |
| Notas | 15% | Moodle | Nota mais baixa (invertida) |
| Financeiro | 15% | ASAAS | em_dia=0, pendente=40, inadimplente=100 |
| Tickets | 10% | Sistema | Tickets abertos + reclamações |
| NPS/CSAT | 10% | Sistema | Promotor=0, Neutro=40, Detrator=100 |

**Níveis:** Crítico (≥75), Alto (≥50), Médio (≥25), Baixo (<25)

**Funcionalidades do dashboard de risco:**
- Cards de nível (Crítico, Alto, Médio, Baixo) com contagem
- **Cards de tendência**: Piorando (7), Melhorando, Risco de abandono (156), Abandonos (5)
- Filtro por tendência (worsening/improving)
- Lista com badges: nível, tendência, delta de score, faltas consecutivas
- Badge de abandono para alunos com 8+ faltas consecutivas

**Detalhe do aluno (risk/[id]):**
- Score circular com nível e tendência
- **Tendências por indicador**: presença, financeiro, engajamento
- **Card de presença**: taxa de faltas, faltas consecutivas, total
- **Componentes do score**: barras visuais para cada indicador
- Fatores de risco com destaque para críticos
- **Histórico semanal**: evolução do score nas últimas 12 semanas

### 5. Integração Financeira (ASAAS)
- 1.038 alunos vinculados por email
- Status financeiro: em dia (275), pendente (549), inadimplente (211)
- R$ 203.657,69 em atraso mapeados
- Página dedicada com filtros, busca por CPF, modal de cobranças
- Sync automático de CPF e telefone

### 6. Motor de Automações
- Scheduler rodando a cada 30 minutos
- **Triggers**: days_without_access, inactive_student, days_after_enrollment, nps_response, first_login, **form_submitted**
- **Ações**: send_whatsapp, create_ticket
- **Template variables**: {name}, {email}, {phone}, {days}, {course}
- Cooldown de 24h entre execuções por aluno
- Página de detalhe com métricas e logs de execução
- **Templates Meta aprovados** com prévia da mensagem
- **Logs de execução registrados** nas automações disparadas pelo onboarding

### 7. Multiatendimento WhatsApp (Multicanal)
- Integração com **Meta Cloud API oficial**
- **Múltiplos canais**: CS, Financeiro (Pedagógico e Atendimento preparados)
- Webhook compartilhado — **todos os números usam a mesma URL**
- **Abas por canal** no frontend (Todos | 💬 CS | 💰 Financeiro)
- Conversas separadas por canal no banco (campo `channel`)
- **Envio de mensagens pelo canal correto** (identifica automaticamente)
- Webhook identifica canal pelo `phone_number_id`
- Conversas organizadas por contato
- Badge de mensagens não lidas (auto-refresh 10s)
- Envio de mensagens de texto
- Envio de templates aprovados pela Meta
- Marcação automática de leitura
- Suporte a tipos: texto, imagem, áudio, vídeo, documento, localização, figurinha

### 8. Templates WhatsApp (Meta)
4 templates criados:

| Template | Status | Variáveis | Uso |
|---|---|---|---|
| `boas_vindas` | ✅ Aprovado | {{1}} nome, {{2}} curso | Onboarding |
| `lembrete_acesso` | ✅ Aprovado | {{1}} nome, {{2}} curso | Aluno inativo |
| `lembrete_pagamento` | Em análise | {{1}} nome, {{2}} curso | Inadimplência |
| `pesquisa_nps` | Em análise | {{1}} nome | Pesquisa NPS |

### 9. Formulário de Onboarding
- **Página pública** em `/onboarding` (não requer login)
- Campos: Nome completo, E-mail, WhatsApp, Curso
- Cursos puxados automaticamente do Moodle
- **Máscara de telefone** (formatação automática)
- Ao enviar: cria/atualiza aluno no banco → dispara automações `form_submitted`
- **WhatsApp de boas-vindas enviado automaticamente** após cadastro
- Tela de sucesso com feedback visual

### 10. NPS/CSAT
- Envio de pesquisas por WhatsApp
- Coleta de score e comentários
- Integração com score de risco

### 11. Sinais do Moodle
- Captura diária de sinais acadêmicos por aluno/curso
- Dados capturados: último acesso, notas, progresso (baseado em notas)
- 1.270 sinais capturados, 1.118 com notas reais

---

## Canais WhatsApp Configurados

| Canal | Número | phone_number_id | Status |
|---|---|---|---|
| **CS / Atendimento** | (84) 9193-4068 | `1034537213068679` | ✅ Ativo |
| **Financeiro** | +55 11 93619-1990 | `1013906571803502` | ✅ Ativo |
| **Pedagógico** | — | — | ⏸️ Preencher depois |
| **Atendimento** | — | — | ⏸️ Preencher depois |

**WABA IDs:**
- CS: `4231468683793541`
- Financeiro: `1610291956664244`

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

# WhatsApp Meta Cloud API — Canais
WA_CS_TOKEN=seu-token-permanente
WA_CS_PHONE_NUMBER_ID=1034537213068679
WA_CS_WABA_ID=4231468683793541

WA_FINANCEIRO_TOKEN=seu-token-permanente
WA_FINANCEIRO_PHONE_NUMBER_ID=1013906571803502
WA_FINANCEIRO_WABA_ID=1610291956664244

WA_PEDAGOGICO_TOKEN=
WA_PEDAGOGICO_PHONE_NUMBER_ID=
WA_PEDAGOGICO_WABA_ID=

WA_ATENDIMENTO_TOKEN=
WA_ATENDIMENTO_PHONE_NUMBER_ID=
WA_ATENDIMENTO_WABA_ID=

# Webhook (compartilhado entre todos os canais)
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
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
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
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cenat.com","password":"admin123"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -s -X POST http://localhost:8000/api/moodle/sync-students -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:8000/api/asaas/sync-customers -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:8000/api/asaas/sync-financial -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:8000/api/moodle/sync-signals -H "Authorization: Bearer $TOKEN"
```

---

## Configuração do WhatsApp (Meta Cloud API)

### Passo a Passo para Novo Número

> ⚠️ **IMPORTANTE**: Siga TODOS os passos abaixo. Pular qualquer etapa faz o canal não funcionar.

#### 1. Adicionar número no App da Meta
1. Acesse **developers.facebook.com** → seu app → **WhatsApp** → **Configuração**
2. Etapa 5: **"Adicionar telefone"**
3. Preencha: Nome de exibição, Fuso horário (America/Sao Paulo), Categoria (Educação)
4. Insira o número e verifique por SMS/ligação
5. Anote o `phone_number_id` que aparece

#### 2. Registrar o número via API
```bash
curl -X POST "https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/register" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"123456"}'
```

#### 3. Ativar com template hello_world
```bash
curl -X POST "https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"{SEU_NUMERO_TESTE}","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}'
```

#### 4. Inscrever WABA no webhook
```bash
curl -X POST "https://graph.facebook.com/v22.0/{WABA_ID}/subscribed_apps" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"override_callback_uri":"https://SEU-DOMINIO/api/webhook/whatsapp","verify_token":"cenat_webhook_2024"}'
```

#### 5. Configurar no sistema
1. Adiciona no `.env`
2. Adiciona no `app/core/whatsapp_channels.py`
3. Adiciona aba no frontend em `conversations/page.tsx`
4. Reinicia o backend

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
| GET | `/api/students` | Lista alunos (filtros: search, login_status, docs_status, financial_status, course_id) |
| GET | `/api/students/stats` | Estatísticas: total, nunca logaram, sem docs, inadimplentes |
| GET | `/api/students/courses` | Lista cursos distintos com contagem |
| GET | `/api/students/{id}` | Detalhe do aluno |
| POST | `/api/students/{id}/sync-moodle` | Sync individual com Moodle |

### Tickets
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tickets` | Lista tickets |
| POST | `/api/tickets` | Criar ticket |
| PATCH | `/api/tickets/{id}/status?status=X` | Mudar status |

### Risco
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/risk/summary` | Resumo: níveis, tendências, abandono |
| GET | `/api/risk/students/at-risk` | Lista alunos em risco (filtros: level, trend) |
| GET | `/api/risk/students/{id}` | Score detalhado com componentes e tendências |
| GET | `/api/risk/students/{id}/history` | Histórico semanal do score |
| POST | `/api/risk/students/{id}/calculate` | Recalcular score |

### Moodle
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/moodle/sync-students` | Sync alunos (+ firstaccess, docs, curso) |
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
| GET | `/api/conversations` | Lista conversas (filtro: `?channel=cs`) |
| GET | `/api/conversations/{id}/messages` | Mensagens da conversa |
| POST | `/api/conversations/{id}/messages` | Enviar mensagem |

### Onboarding (público, sem auth)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/onboarding/courses` | Lista cursos disponíveis |
| POST | `/api/onboarding` | Cadastra aluno e dispara automações |

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
| Onboarding | http://localhost:3000/onboarding |
| Admin | admin@cenat.com / admin123 |
| Banco | postgresql://postgres:postgres@127.0.0.1:5434/cenat_cs |

---

## Dados Atuais

| Métrica | Valor |
|---|---|
| Alunos sincronizados | 1.140 |
| Cursos ativos | 24 |
| Nunca fizeram login | 104 |
| Sem documentos | 181 |
| Docs completos | 959 |
| Vinculados ASAAS | 1.038 |
| Inadimplentes | 211 |
| Valor em atraso | R$ 203.657,69 |
| Risco de abandono | 156 |
| Abandonos confirmados | 5 |
| Sinais Moodle | 1.270 |

---

## Colunas Adicionadas ao Banco (fora das migrations)

Se recriar o banco, execute:
```sql
ALTER TABLE students ADD COLUMN asaas_customer_id VARCHAR(100);
ALTER TABLE students ADD COLUMN financial_status VARCHAR(20);
ALTER TABLE students ADD COLUMN overdue_value FLOAT DEFAULT 0;
ALTER TABLE students ADD COLUMN conta_azul_customer_id VARCHAR(100);
ALTER TABLE students ADD COLUMN moodle_first_access TIMESTAMP NULL;
ALTER TABLE students ADD COLUMN documents_count INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN documents_total INTEGER DEFAULT 5;
ALTER TABLE students ADD COLUMN primary_course_id INTEGER NULL;
ALTER TABLE students ADD COLUMN primary_course_name VARCHAR(255) NULL;
ALTER TABLE students ADD COLUMN attendance_total INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN attendance_absences INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN attendance_consecutive_absences INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN abandonment_status VARCHAR(20);
ALTER TABLE students ADD COLUMN risk_trend VARCHAR(20) DEFAULT 'stable';
ALTER TABLE conversations ADD COLUMN channel VARCHAR(50) DEFAULT 'cs';
```

---

## Reinicialização do Sistema
```bash
# 1. PostgreSQL
docker start cenat-postgres

# 2. Backend
cd ~/Documents/cenat-cs-platform/apps/api
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Frontend (outro terminal)
cd ~/Documents/cenat-cs-platform/apps/web
npm run dev

# 4. ngrok (outro terminal — APENAS em desenvolvimento)
ngrok http 8000
# Depois: atualize o webhook na Meta com a nova URL
```

---

## Pendências
- [ ] Deploy em produção (URL fixa, sem ngrok)
- [ ] Templates `pesquisa_nps` e `lembrete_pagamento` aguardando aprovação da Meta
- [ ] Configurar canais Pedagógico e Atendimento
- [ ] Serviço de e-mail (SendGrid/SMTP)
- [ ] Classificação automática de tickets
- [ ] Coleta de NPS (definir método)
