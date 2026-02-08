# Strategy: AI-Centric Company Management System + Personal Effectiveness Portal

## Last Updated: 2026-02-07 by CLAUDE

---

## Vision

Построить "портал будущего" — систему управления AI-центричной компанией, где ИИ-агенты и люди работают как единая команда. Система постепенно перенимает управленческие задачи у CEO, автоматизируя рутину и предоставляя полную видимость по всем проектам, сотрудникам и агентам.

---

## Architecture Overview

```
CEO (Telegram + Web Dashboard + Obsidian)
         │
         ▼
┌─────────────────────────────┐
│     Central API (Bun + Hono)│
│  Auth / API Keys / WebSocket│
└──────────┬──────────────────┘
           │
    ┌──────┼──────┬──────────┬───────────┐
    ▼      ▼      ▼          ▼           ▼
 Agent   Task   Project   Knowledge   AI Controller
 Orch.   Engine  Manager   Base        (monitoring)
    │      │      │          │           │
    └──────┴──────┴──────────┴───────────┘
                  │
         ┌───────┴────────┐
         │  PostgreSQL     │
         │  Redis (pubsub) │
         └────────────────┘
```

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend Runtime | Bun | Fast, TypeScript-native |
| API Framework | Hono | Lightweight, Bun-native |
| Frontend | Next.js 15 + Tailwind + shadcn/ui | Dashboard UI |
| Database | PostgreSQL + Drizzle ORM | Type-safe, JSONB, concurrent writes |
| Cache/PubSub | Redis | Real-time events, strategy locking |
| Telegram Bot | grammy | TypeScript-first, middleware |
| Monorepo | Turborepo + Bun workspaces | Shared types, single install |
| Agent Coordination | strategy.md + Redis locks | Human-readable, git-tracked |
| AI Evaluations | Claude Sonnet (cost-effective) | Scheduled performance evals |
| **Deployment** | **Vercel (dashboard) + Railway (API, bot, DB, Redis)** | **Managed, easy CI/CD** |

---

## Repository Structure

```
dashboard/
├── packages/
│   ├── api/                    # Bun + Hono API server
│   │   └── src/
│   │       ├── routes/         # REST endpoints
│   │       ├── services/       # Business logic
│   │       ├── db/             # Drizzle schema + migrations
│   │       ├── middleware/     # Auth, rate-limit, logging
│   │       └── ws/             # WebSocket handlers
│   │
│   ├── dashboard/              # Next.js web dashboard
│   │   └── src/
│   │       ├── app/            # Pages (board, projects, agents, tasks...)
│   │       ├── components/     # UI components
│   │       └── lib/            # API client, WS client
│   │
│   ├── telegram-bot/           # Telegram bot (grammy)
│   │   └── src/
│   │       └── handlers/       # CEO commands, employee routing, knowledge
│   │
│   └── shared/                 # Shared types, utils, constants
│       └── src/types/
│
├── strategy.md                 # THIS FILE — agent coordination
├── package.json                # Workspace root
├── turbo.json                  # Turborepo config
└── bun.lockb
```

---

## Core Entities

### Agent
- id, name, type (claude_code / custom / external)
- API key (hashed), permissions, status (active/idle/working/error)
- Current task, current project, last heartbeat

### Employee
- id, name, role, telegram chat ID
- API key (optional), assigned projects, status

### Project
- id, name, description, GitHub repo URL
- strategy.md path, status (active/paused/completed/blocked)
- Assigned agents + employees, blockers, achievements

### Task
- id, title, description, project
- Assignee (agent/employee/CEO), delegated by
- Status (pending/in_progress/review/completed/blocked), priority, due date

### Knowledge Entry
- id, title, URL, content (markdown), AI summary, tags
- Source (telegram/twitter/manual), embeddings for semantic search

### Performance Evaluation
- Subject (agent/employee/project), period
- Metrics: tasks completed, blocked, avg completion time, quality scores
- AI analysis narrative, recommendations

---

## Agent Collaboration Protocol

### Rules
1. **Before ANY work**: Read strategy.md, check Active Tasks and Blockers
2. **Before ANY deploy**: Check Coordination Rules, confirm no blockers
3. **After completing work**: Update strategy.md, add Change Log entry
4. **Commit convention**: `[AGENT_NAME] type: description` (e.g. `[CLAUDE] feat: add auth API`)
5. **Branch isolation**: Agents work on feature branches, never directly on main
6. **Conflicts**: Redis-based locking (30s TTL) prevents simultaneous strategy.md edits

### Current Agents
| Agent | Role | Focus |
|-------|------|-------|
| CLAUDE | Architect + Backend | System design, API, infrastructure, strategy |
| CODE | Frontend + Integration | Dashboard UI, Telegram bot, integrations |

---

## Active Tasks

| Task | Assignee | Status | Priority | Notes |
|------|----------|--------|----------|-------|
| Initialize monorepo structure | CLAUDE | pending | high | Turborepo + Bun workspaces |
| Set up database schema | CLAUDE | pending | high | PostgreSQL + Drizzle |
| Set up API server skeleton | CLAUDE | pending | high | Hono on Bun |
| Initialize Next.js dashboard | CODE | pending | high | App Router + shadcn/ui |
| Build Board View component | CODE | pending | medium | Main CEO interface |
| Set up Telegram bot | CODE | pending | medium | grammy framework |

---

## Implementation Phases

### Phase 0: Setup
- [ ] Create Telegram bot via BotFather, save token
- [ ] Provision PostgreSQL on Railway
- [ ] Provision Redis on Railway
- [ ] Configure environment variables (.env)
- [ ] Set up Vercel project for dashboard
- [ ] Set up Railway project for API + bot

### Phase 1: Foundation
- [ ] Monorepo init (Turborepo + Bun workspaces)
- [ ] Shared types package
- [ ] API server with Hono + Drizzle + PostgreSQL
- [ ] Database schema and migrations
- [ ] API key generation + auth middleware
- [ ] CRUD routes: /projects, /agents, /employees, /tasks
- [ ] Dashboard skeleton (Next.js + Tailwind + shadcn/ui)
- [ ] Basic list views
- [ ] Configure Vercel deploy for dashboard
- [ ] Configure Railway deploy for API

### Phase 2: Telegram + Knowledge Base
- [ ] Telegram bot (grammy) with CEO commands
- [ ] Knowledge ingestion (URL -> extract -> summarize -> store)
- [ ] Obsidian vault sync
- [ ] Knowledge base view in dashboard

### Phase 3: Agent Collaboration
- [ ] StrategyManager service (read/write/lock strategy.md)
- [ ] GitHub integration (Octokit)
- [ ] Agent heartbeat system
- [ ] Real-time status updates (WebSocket)
- [ ] Strategy change history + attribution

### Phase 4: Board View + Employee Integration
- [ ] Large Board View with project cards
- [ ] Real-time updates via WebSocket
- [ ] Employee Telegram interaction
- [ ] Task delegation UI
- [ ] Per-project status dashboard

### Phase 5: AI Controller
- [ ] Scheduled evaluations (daily/weekly)
- [ ] Signal gathering from all sources
- [ ] LLM-powered performance analysis
- [ ] Alerting via Telegram
- [ ] Performance dashboard

### Phase 6: Advanced Features
- [ ] Twitter monitoring
- [ ] Semantic search (pgvector)
- [ ] Natural language task creation
- [ ] Advanced board with React Flow
- [ ] Historical analytics

---

## Additional Ideas (CLAUDE)

### 1. "CEO Autopilot" Mode
Система должна уметь работать в двух режимах:
- **Manual**: CEO принимает все решения, агенты только исполняют
- **Autopilot**: AI Controller автономно распределяет задачи, решает мелкие блокеры, эскалирует только критичное
Переход между режимами — через dashboard или Telegram команду `/autopilot on|off`

### 2. Morning Briefing
Каждое утро CEO получает в Telegram краткий дайджест:
- Что сделано за ночь (агенты работают 24/7)
- Текущие блокеры
- Задачи, требующие решения CEO
- Метрики по проектам (прогресс %, скорость)
- Рекомендации AI Controller

### 3. Decision Queue
Не все решения требуют немедленной реакции CEO. Система ведет очередь решений:
- **Urgent**: Push-уведомление в Telegram немедленно
- **Important**: Включается в morning briefing
- **Low**: Копится, показывается в dashboard на борде

### 4. Agent Memory & Context
Каждый агент (CLAUDE, CODE, future agents) должен иметь:
- `memory.md` — долгосрочная память (ошибки, паттерны, предпочтения CEO)
- Контекст текущего проекта (strategy.md + последние коммиты + открытые PR)
- История взаимодействий с CEO и другими агентами

### 5. "Onboarding Protocol" для новых агентов/сотрудников
При добавлении в проект, система автоматически:
1. Отправляет strategy.md проекта
2. Отправляет краткое описание архитектуры
3. Показывает текущие задачи и блокеры
4. Назначает первую задачу (или предлагает CEO выбрать)

### 6. Knowledge Graph
Знания из базы знаний должны быть связаны:
- Статья -> теги -> проекты (где эти знания применимы)
- Статья -> задачи (которые были созданы на основе этих знаний)
- Связи между статьями (AI определяет похожие/связанные)

### 7. Escalation Chain
Если агент заблокирован > 30 минут:
1. Пробует решить сам (ищет в knowledge base)
2. Запрашивает помощь у другого агента через strategy.md
3. Эскалирует CEO через Telegram
4. AI Controller фиксирует время блокировки для метрик

### 8. Project Templates
Для быстрого запуска проектов — шаблоны:
- SaaS product (repo + CI/CD + monitoring + strategy.md)
- Landing page (repo + Vercel deploy + A/B testing)
- API service (repo + Railway deploy + docs)
- Content project (repo + Obsidian vault + publishing pipeline)

### 9. Financial Tracking (future)
Per-project cost tracking:
- API costs (LLM calls per agent per project)
- Infrastructure costs (Railway/Vercel usage)
- Human employee hours
- ROI per project

### 10. Multi-channel Input
CEO должен иметь возможность отправлять задачи/контент через:
- Telegram (основной)
- Web dashboard (формы)
- Email (forward to system)
- Voice messages (Telegram voice -> transcription -> task/knowledge)
- Screenshots (OCR -> knowledge base)

---

## Coordination Rules

1. CLAUDE handles: architecture, backend API, database, infrastructure, strategy
2. CODE handles: frontend dashboard, Telegram bot, UI components, integrations
3. Both agents check strategy.md before starting any new task
4. API changes require OpenAPI spec update before merge
5. Deploy requires confirmation from both agents in strategy.md
6. Blockers must be immediately reported in strategy.md

---

## Blockers

_None currently_

---

## Achievements

_Project initialized on 2026-02-07_

---

## Change Log

- 2026-02-07 [CLAUDE]: Created initial strategy.md with full system architecture, tech stack, implementation phases, and agent collaboration protocol
- 2026-02-07 [CLAUDE]: Added Phase 0 (service setup), deployment target: Vercel + Railway. CEO confirmed need to set up Telegram bot and PostgreSQL
- 2026-02-07 [CLAUDE]: Added 10 additional ideas: CEO Autopilot mode, Morning Briefing, Decision Queue, Agent Memory, Onboarding Protocol, Knowledge Graph, Escalation Chain, Project Templates, Financial Tracking, Multi-channel Input
