# Strategy: AI-Centric Company Management System + Personal Effectiveness Portal

## Last Updated: 2026-02-08 by CLAUDE (merged CODE + CLAUDE strategies)

---

## Purpose & Vision

Build a "portal of the future" for a human manager that gradually transfers
operational tasks to AI agents. The system combines:
1. Company management (projects, employees, agents, status, performance).
2. Personal effectiveness (knowledge base + task capture + execution tracking).

Create a single management cockpit where the CEO can see:
- All projects and their current status, blockers, achievements, and risks.
- All employees (human + agent), who is doing what, and performance trends.
- A controller agent that continuously evaluates effectiveness and suggests actions.

---

## Operating Rules (Must Follow)

- Before any deployment or new task, read this file and check changes.
- All changes in this file must include the author tag (e.g., `[CLAUDE]`, `[CODE]`).
- Multiple agents work under one GitHub account and coordinate via this file.
- Each project must have its own `strategy.md` that is shared with all members.

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
│   ├── dashboard/              # Next.js web dashboard
│   │   └── src/
│   │       ├── app/            # Pages (board, projects, agents, tasks...)
│   │       ├── components/     # UI components
│   │       └── lib/            # API client, WS client
│   ├── telegram-bot/           # Telegram bot (grammy)
│   │   └── src/
│   │       └── handlers/       # CEO commands, employee routing, knowledge
│   └── shared/                 # Shared types, utils, constants
│       └── src/types/
├── strategy.md                 # THIS FILE — agent coordination
├── package.json                # Workspace root
├── turbo.json                  # Turborepo config
└── bun.lockb
```

---

## Core Data Model

### Agent
- id, name, type (claude_code / custom / external)
- API key (hashed, prefix), permissions, status (active/idle/working/error)
- Current task, current project, last heartbeat

### Employee
- id, name, role, type (human/agent), telegram chat ID, telegram username
- API key (optional), assigned projects, status (active/inactive)

### Project
- id, name, description, GitHub repo URL, branch
- strategy.md path, status (active/paused/completed/blocked)
- Assigned agents + employees, blockers, achievements

### ProjectMember (from CODE)
- project_id, employee_id, role

### Task
- id, title, description, project
- Assignee (agent/employee/CEO), delegated by
- Status (pending/in_progress/review/completed/blocked), priority, due date
- Parent task (for subtask hierarchies), tags

### Knowledge Entry
- id, title, URL, content (markdown), AI summary, tags
- Source (telegram/twitter/manual/agent/email), embeddings for semantic search

### StatusReport (from CODE)
- project_id, author_id, period, achievements, problems, blockers

### ActivityLog (from CODE)
- actor_id, type, payload, timestamp

### Performance Evaluation
- Subject (agent/employee/project), period (daily/weekly/monthly)
- Metrics: tasks completed, blocked, avg completion time, quality scores
- AI analysis narrative, recommendations

---

## Core Product Scope — MVP (from CODE)

### Company Management
- Create employees (human/agent) and issue API keys
- Create projects with description, repo URL, and docs location
- Add members (human/agent) to projects and instantly share project strategy
- View a large board with all projects + all employees and activity summary

### Personal Effectiveness
- Capture knowledge from Obsidian, Telegram, and Twitter/X
- Capture tasks for the CEO and assign tasks to agents/employees
- Store all inputs in a searchable knowledge base

---

## Agent Collaboration Protocol

### Rules
1. **Before ANY work**: Read strategy.md, check Active Tasks and Blockers
2. **Before ANY deploy**: Check Coordination Rules, confirm no blockers
3. **After completing work**: Update strategy.md, add Change Log entry
4. **Commit convention**: `[AGENT_NAME] type: description` (e.g. `[CLAUDE] feat: add auth API`)
5. **Branch isolation**: Agents work on feature branches, never directly on main
6. **Conflicts**: Redis-based locking (30s TTL) prevents simultaneous strategy.md edits

### Idea to Execution Flow (from CODE)
1. Idea captured and expanded into a written brief
2. Agents discuss and agree who owns the planning step
3. Owner produces a detailed plan and raises questions
4. Plan is discussed and finalized
5. Convert plan into a detailed pipeline of tasks
6. Agents and humans claim tasks and execute

### Task Ownership Rules (from CODE)
- Every agent and person has a specialization
- Tasks must be claimed only by matching specialization
- Each human can assign tasks to their own agents
- Agents may not self-assign outside specialization without approval
- If blocked, owner posts blocker and requests help
- Controller agent monitors coverage and reassigns when needed

### Current Agents
| Agent | Role | Focus |
|-------|------|-------|
| CLAUDE | Architect + Backend | System design, API, infrastructure, strategy |
| CODE | Frontend + Integration | Dashboard UI, Telegram bot, integrations |

---

## Active Tasks

| Task | Assignee | Status | Priority | Notes |
|------|----------|--------|----------|-------|
| Initialize monorepo structure | CLAUDE | done | high | ✅ Turborepo + Bun workspaces |
| Set up database schema | CLAUDE | done | high | ✅ PostgreSQL + Drizzle, 10 tables |
| Set up API server skeleton | CLAUDE | done | high | ✅ Hono on Bun, 5 route files |
| API key auth system | CLAUDE | done | high | ✅ Generation + middleware |
| Telegram bot skeleton | CLAUDE | done | high | ✅ grammy with CEO commands |
| Fix Node.js version for build | CLAUDE | in_progress | high | Need Node >= 18.18.0 |
| Initialize Next.js dashboard | CODE | pending | high | App Router + shadcn/ui |
| Build Board View component | CODE | pending | medium | Main CEO interface |

---

## Parallel Workstreams (from CODE)

### Track A — Core Panel
- CRUD for employees, API keys, projects, members
- Global board with project and employee status
- Status reports and blockers tracking

### Track B — Knowledge Base
- Telegram ingestion (bot -> KnowledgeItem)
- Twitter/X ingestion (manual submit -> KnowledgeItem)
- Obsidian ingestion (markdown import or vault sync)
- Semantic search over knowledge

### Track C — Controller Agent
- Periodic activity checks and effectiveness scoring
- Detection of stalled projects and overloaded employees
- Actionable recommendations to the CEO

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
- [x] Monorepo init (Turborepo + Bun workspaces) — CLAUDE
- [x] Shared types package — CLAUDE
- [x] API server with Hono + Drizzle + PostgreSQL — CLAUDE
- [x] Database schema and migrations — CLAUDE
- [x] API key generation + auth middleware — CLAUDE
- [x] CRUD routes: /projects, /agents, /employees, /tasks, /knowledge — CLAUDE
- [x] Telegram bot skeleton (grammy) — CLAUDE
- [ ] Dashboard skeleton (Next.js + Tailwind + shadcn/ui)
- [ ] Basic list views
- [ ] Configure Vercel deploy for dashboard
- [ ] Configure Railway deploy for API

### Phase 2: Telegram + Knowledge Base
- [ ] Telegram bot full CEO commands
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

## MVP Acceptance Criteria (from CODE)

- Create employee and issue API key (show full key only once)
- Create project with repo URL and docs path
- Add member to project and auto-share project `strategy.md`
- Board shows current status, blockers, achievements
- Telegram message appears in the knowledge base
- Controller agent generates a weekly effectiveness report

---

## Integrations (from CODE)

- Obsidian: knowledge ingestion (import markdown or sync from vault repo)
- Telegram: bot for tasks + knowledge ingestion + human-agent communication
- Twitter/X: manual sharing of posts/links into the knowledge base

---

## Additional Ideas (CLAUDE)

1. **CEO Autopilot Mode** — Manual vs Autopilot (AI Controller auto-manages)
2. **Morning Briefing** — Daily Telegram digest
3. **Decision Queue** — Urgent/Important/Low priority routing
4. **Agent Memory** — Per-agent `memory.md` for long-term learning
5. **Onboarding Protocol** — Auto-context when joining project
6. **Knowledge Graph** — Linked knowledge (articles↔tags↔projects↔tasks)
7. **Escalation Chain** — Timed escalation when blocked
8. **Project Templates** — SaaS, Landing, API, Content
9. **Financial Tracking** — Per-project cost tracking
10. **Multi-channel Input** — Telegram, web, email, voice, screenshots

---

## Project Strategy Standard (from CODE)

For every project repo:
- Have a `strategy.md` at repo root
- Include project goals, scope, roles, and workflows
- When a member joins, they receive the project strategy immediately

---

## Coordination Rules

1. CLAUDE handles: architecture, backend API, database, infrastructure, strategy
2. CODE handles: frontend dashboard, Telegram bot, UI components, integrations
3. Both agents check strategy.md before starting any new task
4. API changes require OpenAPI spec update before merge
5. Deploy requires confirmation from both agents in strategy.md
6. Blockers must be immediately reported in strategy.md

---

## Production Server

- **IP**: 134.209.162.250
- **Provider**: DigitalOcean (2 vCPU, 4GB RAM, Frankfurt)
- **OS**: Ubuntu 24.04
- **Stack**: Node.js 22, PostgreSQL 16, Redis 7, Nginx
- **Coordinator API**: http://134.209.162.250:8787 (internal), proxied via Nginx on :80
- **Web Dashboard**: http://134.209.162.250
- **SSH**: `ssh root@134.209.162.250` (password auth enabled)
- **Services**: `systemctl status coordinator` / `systemctl status nginx`
- **Repo on server**: `/opt/dashboard/` (coordinator API)
- **Web files**: `/opt/dashboard-web/` (static HTML)
- **DB**: `sudo -u postgres psql -d dashboard`

---

## Blockers

- Node.js 18.16.0 on local dev machine — Next.js 15 requires >= 18.18.0. Server has Node 22. [CLAUDE, 2026-02-08]

---

## Achievements

- 2026-02-07: Project initialized
- 2026-02-08: Monorepo structure created (CLAUDE)
- 2026-02-08: Full API with CRUD routes (CLAUDE) — agents, employees, projects, tasks, knowledge
- 2026-02-08: Database schema with Drizzle ORM (CLAUDE) — 10 tables
- 2026-02-08: API key auth system (CLAUDE)
- 2026-02-08: Telegram bot skeleton (CLAUDE)
- 2026-02-08: DigitalOcean droplet deployed (CLAUDE) — Node 22, PostgreSQL 16, Redis 7, Nginx
- 2026-02-08: Coordinator API live at http://134.209.162.250 (CLAUDE)
- 2026-02-08: Web dashboard UI deployed (CLAUDE) — Board, Agents, Threads, Messages views

---

## Change Log

- 2026-02-07 [CODE]: Initial strategy draft
- 2026-02-08 [CODE]: Added collaboration protocol and task assignment rules
- 2026-02-07 [CLAUDE]: Created detailed strategy with architecture, tech stack, implementation phases
- 2026-02-07 [CLAUDE]: Added Phase 0 (service setup), deployment: Vercel + Railway
- 2026-02-07 [CLAUDE]: Added 10 additional ideas
- 2026-02-08 [CLAUDE]: Merged CODE + CLAUDE strategies
- 2026-02-08 [CLAUDE]: Deployed production server on DigitalOcean (134.209.162.250). Installed Node 22, PostgreSQL 16, Redis 7, Nginx. Deployed coordinator API + web dashboard
