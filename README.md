# CENAT CS Platform — Sistema de Retenção de Alunos

## Visão Geral

Plataforma de Customer Success para instituições de ensino superior. Integra dados acadêmicos (Moodle), financeiros (ASAAS) e comunicação (WhatsApp Meta Cloud API) para monitorar, engajar e reter alunos de forma proativa.

```
[Moodle]  ──▶  Alunos, Cursos, Progresso, Notas, Último Acesso, Documentos
[ASAAS]   ──▶  Cobranças, Status Financeiro, CPF, Telefone
[WhatsApp Meta Cloud API]  ◀──▶  Comunicação bidirecional (multicanal)
                    │
                    ▼
          ┌─────────────────────┐
          │   CENAT CS Platform │
          │  FastAPI + Next.js  │
          │  PostgreSQL + Redis │
          └─────────────────────┘
                    │
                    ▼
    [Dashboard] [Tickets] [Kanban] [Automações] [Réguas]
    [Risco]     [NPS]     [Financeiro] [WhatsApp]
    [Relatórios] [Disparos] [Conversas] [Usuários]
```

**Produção:** https://pedagogico.cenatdata.online

---

## Stack

### Backend

| Tecnologia | Versão | Uso |
|---|---|---|
| FastAPI | 0.100+ | API REST assíncrona |
| PostgreSQL | 14+ | Banco de dados principal |
| SQLAlchemy | 2.0+ | ORM |
| Redis | 7+ | Cache e filas |
| httpx | latest | HTTP client assíncrono |
| Pydantic | 2.0+ | Validação de dados |
| openpyxl | latest | Exportação Excel |
| fpdf2 | latest | Exportação PDF |
| passlib[bcrypt] | latest | Hash de senhas |
| python-jose | latest | JWT tokens |

### Frontend

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 16+ | Framework React (App Router) |
| TypeScript | 5+ | Tipagem estática |
| Tailwind CSS | 3+ | Estilização utility-first |
| Lucide React | latest | Ícones |
| Axios | latest | HTTP client |
| Sonner | latest | Notificações toast |
| @dnd-kit | core + utilities | Drag and drop (Kanban) |

### Integrações

| Serviço | Uso |
|---|---|
| Moodle | Alunos, cursos, progresso, notas, último acesso, documentos |
| ASAAS | Cobranças, status financeiro, CPF |
| WhatsApp Meta Cloud API | Envio/recebimento de mensagens (multicanal) |

---

## Funcionalidades Implementadas

### Fase 1 — Disparos em Massa ✅
- Wizard de 4 passos: filtros → template → preview → envio
- Templates aprovados pela Meta
- Delay configurável entre envios
- Logs detalhados por aluno (entregue, lido, falha)
- Página de detalhe com métricas em tempo real

### Fase 2 — Réguas de Automação ✅
- Jornadas multi-step com delay configurável
- Triggers: dias sem acesso, inadimplência, primeiro login, formulário
- Ações: envio WhatsApp, criação de ticket
- Scheduler executando a cada 5 minutos
- Frontend visual de criação de jornadas

### Fase 3 — Relatórios e Exportação ✅
- Dashboard executivo com KPIs agregados
- Relatório de inadimplência por curso com top 10 devedores
- Relatório de desempenho por curso (Moodle + financeiro + risco)
- Exportação PDF profissional (3 páginas, cores, tabelas)
- Exportação Excel (2 abas com formatação)
- Links rápidos entre relatórios

### Fase 4 — Gestão de Equipe e Permissões ✅
- 4 roles: Admin, Gestor, Atendente, Visualizador
- Matriz de permissões por módulo (9 módulos)
- Middleware backend `require_permission` em todas as rotas
- Hook frontend `usePermissions` para controle de UI
- Sidebar dinâmica filtrada por role
- CRUD completo de usuários (criar, editar, ativar/desativar)

### Fase 9 — PWA ✅
- manifest.json configurado
- Service Worker com cache (network-first)
- Ícones 192x192 e 512x512
- Layout responsivo mobile-first
- Header mobile com hamburger menu
- Sidebar como drawer deslizante
- KPIs em grid 2x2 no mobile
- Tabelas com scroll horizontal

### Outras Funcionalidades

**Dashboard:** KPIs em tempo real, distribuição de risco, taxa de retenção, NPS/CSAT

**Gestão de Alunos:** 1.185 alunos sincronizados, 24 cursos, filtros avançados (curso, login, documentos, financeiro), paginação server-side

**Tickets:** Lista + Kanban drag-and-drop, protocolo automático, SLA tracking, criação automática via WhatsApp, reabertura inteligente

**Score de Risco:** 6 indicadores ponderados (engajamento 25%, progresso 25%, notas 15%, financeiro 15%, tickets 10%, NPS 10%), níveis Crítico/Alto/Médio/Baixo, tendências e histórico semanal

**Financeiro:** Sync em batch do ASAAS (8.600+ cobranças), status em dia/pendente/inadimplente, valor em atraso por aluno, modal de cobranças

**WhatsApp Multicanal:** Meta Cloud API, canais CS e Financeiro, webhook compartilhado, conversas por canal, templates aprovados

**Onboarding:** Formulário público, cursos do Moodle, WhatsApp de boas-vindas automático

---

## Estrutura do Projeto

```
cenat-cs-platform/
├── apps/
│   ├── api/                          # Backend FastAPI
│   │   ├── app/
│   │   │   ├── api/routes/           # Endpoints REST
│   │   │   │   ├── auth.py           # Login, /me
│   │   │   │   ├── students.py       # CRUD alunos + filtros
│   │   │   │   ├── tickets.py        # Tickets de atendimento
│   │   │   │   ├── risk.py           # Score de risco
│   │   │   │   ├── broadcasts.py     # Disparos em massa
│   │   │   │   ├── journeys.py       # Réguas de automação
│   │   │   │   ├── reports.py        # Relatórios + exportação PDF/Excel
│   │   │   │   ├── users.py          # CRUD usuários + permissões
│   │   │   │   ├── conversations.py  # WhatsApp multicanal
│   │   │   │   ├── asaas.py          # Sync financeiro
│   │   │   │   ├── moodle.py         # Sync acadêmico
│   │   │   │   ├── automations.py    # Motor de automações
│   │   │   │   ├── webhooks.py       # Webhook Meta WhatsApp
│   │   │   │   └── ...
│   │   │   ├── core/
│   │   │   │   ├── deps.py           # get_db, get_current_user
│   │   │   │   ├── security.py       # JWT, hashing
│   │   │   │   ├── permissions.py    # Middleware de autorização
│   │   │   │   └── whatsapp_channels.py
│   │   │   ├── db/
│   │   │   │   ├── session.py        # Engine + SessionLocal
│   │   │   │   └── base.py           # Base declarativa
│   │   │   ├── models/               # SQLAlchemy models
│   │   │   ├── services/             # Lógica de negócios
│   │   │   ├── integrations/         # Clients externos (Moodle, WhatsApp)
│   │   │   └── jobs/                 # Sync jobs
│   │   ├── .env
│   │   └── requirements.txt
│   │
│   └── web/                          # Frontend Next.js
│       └── src/
│           ├── app/                   # Pages (App Router)
│           │   ├── page.tsx           # Dashboard
│           │   ├── students/          # Gestão de alunos
│           │   ├── tickets/           # Tickets + Kanban
│           │   ├── risk/              # Score de risco
│           │   ├── broadcasts/        # Disparos em massa
│           │   ├── automations/       # Réguas + automações
│           │   ├── reports/           # Dashboard executivo
│           │   │   ├── inadimplencia/ # Relatório inadimplência
│           │   │   └── courses/       # Desempenho por curso
│           │   ├── conversations/     # WhatsApp multicanal
│           │   ├── financial/         # Gestão financeira
│           │   ├── users/             # Gestão de usuários
│           │   └── ...
│           ├── components/
│           │   ├── AppLayout.tsx       # Layout responsivo
│           │   ├── Sidebar.tsx         # Menu com permissões
│           │   └── ServiceWorkerRegister.tsx
│           ├── hooks/
│           │   └── usePermissions.ts   # Hook de permissões
│           ├── contexts/
│           │   └── auth-context.tsx
│           └── lib/
│               └── api.ts
```

---

## Permissões por Role

| Módulo | Admin | Gestor | Atendente | Visualizador |
|--------|-------|--------|-----------|-------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Alunos | CRUD | CRUD | Ler | Ler |
| Tickets | CRUD | CRUD | CRUD | Ler |
| Conversas | ✅ | ✅ | ✅ | Ler |
| Disparos | CRUD | CRUD | ❌ | ❌ |
| Automações | CRUD | Ler | ❌ | ❌ |
| Relatórios | ✅ | ✅ | ❌ | ✅ |
| Financeiro | ✅ | ✅ | ❌ | Ler |
| Usuários | CRUD | ❌ | ❌ | ❌ |

---

## Deploy — Produção

### Infraestrutura

| Componente | Serviço |
|---|---|
| Servidor | AWS Lightsail (Ubuntu, 2GB RAM, 2 vCPUs) |
| Banco | PostgreSQL 14 (local) |
| Frontend | Next.js via systemd (porta 3000) |
| Backend | FastAPI/Uvicorn via systemd (porta 8000) |
| Proxy | Nginx com SSL (Certbot) |
| Domínio | pedagogico.cenatdata.online |

### Serviços systemd

```bash
# Backend
sudo systemctl status cenat-api
sudo systemctl restart cenat-api
sudo journalctl -u cenat-api -f

# Frontend
sudo systemctl status cenat-web
sudo systemctl restart cenat-web
sudo journalctl -u cenat-web -f
```

### Deploy de atualizações

```bash
# No servidor
cd /home/ubuntu/cenat-cs-platform
git pull origin main
cd apps/api && source venv/bin/activate && pip install -r requirements.txt
cd ../web && npm install && npm run build
sudo systemctl restart cenat-api cenat-web
```

---

## Desenvolvimento Local

### Pré-requisitos
- Python 3.10+
- Node.js 18+
- Docker (para PostgreSQL)

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

---

## Canais WhatsApp

| Canal | Número | phone_number_id | Status |
|---|---|---|---|
| CS / Atendimento | (84) 9193-4068 | 1034537213068679 | ✅ Ativo |
| Financeiro | +55 11 93619-1990 | 1013906571803502 | ✅ Ativo |
| Pedagógico | — | — | ⏸️ Pendente |

---

## Dados em Produção

| Métrica | Valor |
|---|---|
| Alunos sincronizados | 1.185 |
| Cursos ativos | 24 |
| Nunca fizeram login | 104 |
| Sem documentos | 181 |
| Docs completos | 959 |
| Vinculados ASAAS | 1.046 |
| Em dia | 293 |
| Pendentes | 553 |
| Inadimplentes | 200 |
| Valor em atraso | R$ 195.035,97 |
| Sinais Moodle | 2.542 |
| Risk scores | 1.131 |

---

## Roadmap

| Fase | Status |
|------|--------|
| 1 - Disparos em massa | ✅ Concluída |
| 2 - Réguas de automação | ✅ Concluída |
| 3 - Relatórios e exportação | ✅ 5/9 itens |
| 4 - Gestão de equipe | ✅ 5/8 itens |
| 5 - LGPD / Compliance | ⏸️ Adiada |
| 6 - Multi-tenancy (SaaS) | ❌ Pendente |
| 7 - Portal do aluno | ❌ Pendente |
| 8 - E-mail transacional | ❌ Pendente |
| 9 - PWA (App Mobile) | ✅ Configurado |
| 10 - Inteligência Artificial | ❌ Pendente |
| 11 - Captação de alunos | ❌ Pendente |
| 12 - Integrações expandidas | ❌ Pendente |
| 13 - Documentação | ❌ Pendente |

---

## Colunas extras no banco (fora das migrations)

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