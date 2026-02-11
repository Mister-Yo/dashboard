# orkwork v2 — Technical Specification
# AI-Centric Company Operating System

**Author:** CTO (Mister Boss)  
**Date:** 2026-02-11  
**Status:** Draft  
**Target:** Q2 2026

---

## 1. Vision

orkwork v1 — це MVP дашборду для AI-компанії. Він показує що відбувається.

**orkwork v2** — це **операційна система** AI-компанії. Вона не просто показує — вона **керує, думає і діє**.

### Ключова зміна парадигми

| v1 (Dashboard) | v2 (Operating System) |
|---|---|
| Люди дають задачі агентам | Агенти самі беруть задачі |
| CEO перевіряє вручну | AI Controller перевіряє автоматично |
| Координація через чат | Координація через протоколи |
| Один канал (Telegram) | Мультиканал (Telegram, Slack, Email, Web) |
| Агенти працюють ізольовано | Агенти колаборують через shared context |
| Статичний дашборд | Real-time ops center з actionable insights |
| Ручні деплої | Автономний CI/CD pipeline |

---

## 2. Architecture

### 2.1 High-Level

```
┌─────────────────────────────────────────────────────────┐
│                    ORKWORK OS v2                         │
│                                                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │ Web App  │  │ Telegram  │  │ Slack / Discord / … │  │
│  │ (Next.js)│  │ (Grammy)  │  │ (Adapters)           │  │
│  └────┬─────┘  └─────┬─────┘  └──────────┬───────────┘  │
│       │               │                   │              │
│  ┌────▼───────────────▼───────────────────▼────────┐     │
│  │              API Gateway (Hono)                  │     │
│  │  Auth · Rate Limit · Routing · WebSocket · SSE  │     │
│  └────┬──────────┬──────────┬──────────┬───────────┘     │
│       │          │          │          │                  │
│  ┌────▼───┐ ┌───▼────┐ ┌───▼───┐ ┌───▼──────────┐      │
│  │ Agent  │ │ Task   │ │ Comms │ │ Intelligence │      │
│  │ Runtime│ │ Engine │ │ Hub   │ │ Engine       │      │
│  └────┬───┘ └───┬────┘ └───┬───┘ └───┬──────────┘      │
│       │         │          │         │                   │
│  ┌────▼─────────▼──────────▼─────────▼────────────┐     │
│  │              Data Layer                         │     │
│  │  PostgreSQL · Redis · S3 · Vector DB (pgvector) │     │
│  └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Core Modules

#### Agent Runtime
- **Agent Registry** — реєстрація, capabilities, permissions, SLA
- **Agent Lifecycle** — spawn, configure, monitor, retire
- **Execution Sandbox** — ізольоване середовище для кожного агента
- **Tool System** — набір інструментів (git, shell, API calls, browser)
- **Memory System** — short-term (context window), long-term (vector DB)
- **Heartbeat & Health** — автоматичний моніторинг, auto-restart при збоях

#### Task Engine
- **Task Graph** — DAG задач з залежностями
- **Auto-Assignment** — на основі capabilities, workload, priority
- **Execution Tracking** — реальний час, прогрес, блокери
- **SLA Monitoring** — дедлайни, ескалації, оповіщення
- **Task Templates** — повторювані workflow як шаблони
- **Human-in-the-Loop** — точки де потрібне людське рішення

#### Communications Hub
- **Unified Inbox** — всі повідомлення з усіх каналів в одному місці
- **Thread System** — контекстні дискусії по задачах/проектах
- **Notifications Engine** — smart routing (urgent → push, info → digest)
- **Channel Adapters** — Telegram, Slack, Discord, Email, SMS, Web
- **Translation Layer** — auto-translate для мультимовних команд

#### Intelligence Engine
- **Performance Analytics** — KPI по агентах, людях, проектах
- **Anomaly Detection** — виявлення проблем до того як вони стануть блокерами
- **Cost Tracking** — витрати на API, compute, tokens per agent
- **Recommendations** — AI-powered suggestions для CEO
- **Forecasting** — прогноз завершення проектів, bottleneck detection
- **Daily/Weekly Briefs** — автоматичні зведення для CEO

---

## 3. Data Model v2

### 3.1 Нові сутності

```sql
-- Agent capabilities and tools
CREATE TABLE agent_capabilities (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  capability TEXT NOT NULL,        -- 'code:typescript', 'code:python', 'devops:docker', etc.
  proficiency REAL DEFAULT 0.5,    -- 0.0-1.0, updates based on performance
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent memory (long-term knowledge per agent)
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  memory_type TEXT NOT NULL,       -- 'fact', 'preference', 'lesson', 'context'
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  relevance_score REAL DEFAULT 1.0,
  expires_at TIMESTAMP,            -- optional TTL
  created_at TIMESTAMP DEFAULT NOW()
);

-- Task dependencies (DAG)
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  depends_on_task_id UUID REFERENCES tasks(id),
  dependency_type TEXT DEFAULT 'blocks', -- 'blocks', 'soft', 'related'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Task execution logs (detailed)
CREATE TABLE task_executions (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  agent_id UUID REFERENCES agents(id),
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status TEXT NOT NULL,            -- 'running', 'success', 'failed', 'timeout'
  output TEXT,
  error TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  duration_ms INTEGER
);

-- Workflows (task templates)
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL,            -- ordered list of task templates
  trigger_type TEXT,               -- 'manual', 'schedule', 'event', 'webhook'
  trigger_config JSONB,
  created_by TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  recipient_type TEXT NOT NULL,    -- 'agent', 'employee', 'role'
  recipient_id TEXT NOT NULL,
  channel TEXT NOT NULL,           -- 'telegram', 'email', 'web', 'slack'
  priority TEXT DEFAULT 'normal',  -- 'urgent', 'high', 'normal', 'low'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',   -- 'pending', 'sent', 'read', 'failed'
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cost tracking
CREATE TABLE cost_entries (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  project_id UUID REFERENCES projects(id),
  cost_type TEXT NOT NULL,         -- 'api_tokens', 'compute', 'storage', 'external_api'
  amount_usd REAL NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  model TEXT,                      -- 'claude-sonnet-4-20250514', 'gpt-4o', etc.
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SLA definitions
CREATE TABLE sla_rules (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  target_type TEXT NOT NULL,       -- 'task_priority', 'agent_type', 'project'
  target_value TEXT NOT NULL,      -- 'high', 'claude_code', project_id
  max_response_minutes INTEGER,    -- time to first action
  max_resolution_minutes INTEGER,  -- time to completion
  escalation_chain JSONB,          -- [{after_min: 30, notify: 'ceo'}, ...]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Decision log (for auditability)
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  decision_type TEXT NOT NULL,     -- 'task_assign', 'deploy', 'escalate', 'approve'
  made_by TEXT NOT NULL,           -- agent_id or employee_id
  context TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT,                  -- AI's reasoning chain
  outcome TEXT,                    -- filled after execution
  project_id UUID REFERENCES projects(id),
  task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Розширення існуючих таблиць

```sql
-- agents: додаємо
ALTER TABLE agents ADD COLUMN daily_budget_usd REAL;
ALTER TABLE agents ADD COLUMN total_spent_usd REAL DEFAULT 0;
ALTER TABLE agents ADD COLUMN autonomy_level TEXT DEFAULT 'supervised';
  -- 'supervised' = потрібне підтвердження CEO
  -- 'semi-auto' = діє сам, але CEO може overrideʼнути
  -- 'autonomous' = повна автономія в межах capabilities
ALTER TABLE agents ADD COLUMN sla_rule_id UUID REFERENCES sla_rules(id);
ALTER TABLE agents ADD COLUMN model TEXT;  -- preferred LLM model
ALTER TABLE agents ADD COLUMN max_concurrent_tasks INTEGER DEFAULT 1;

-- tasks: додаємо
ALTER TABLE tasks ADD COLUMN estimated_hours REAL;
ALTER TABLE tasks ADD COLUMN actual_hours REAL;
ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT;
ALTER TABLE tasks ADD COLUMN review_required BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN auto_assigned BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN max_retries INTEGER DEFAULT 3;

-- projects: додаємо
ALTER TABLE projects ADD COLUMN budget_usd REAL;
ALTER TABLE projects ADD COLUMN spent_usd REAL DEFAULT 0;
ALTER TABLE projects ADD COLUMN deadline TIMESTAMP;
ALTER TABLE projects ADD COLUMN health_score REAL; -- 0.0-1.0, auto-calculated
ALTER TABLE projects ADD COLUMN risk_level TEXT DEFAULT 'low';
```

---

## 4. Agent Autonomy Framework

### 4.1 Рівні автономії

```
Level 0: TOOL      — Агент = інструмент. Людина задає задачу, агент виконує.
Level 1: ASSISTANT — Агент пропонує рішення, людина підтверджує.
Level 2: SUPERVISED — Агент діє сам, людина моніторить і може зупинити.
Level 3: AUTONOMOUS — Агент діє повністю сам в межах scope та бюджету.
Level 4: STRATEGIC  — Агент приймає стратегічні рішення, сам створює задачі.
```

### 4.2 Guardrails

Кожен рівень має обмеження:

| Action | L0 | L1 | L2 | L3 | L4 |
|--------|----|----|----|----|-----|
| Execute assigned task | ✅ | ✅ | ✅ | ✅ | ✅ |
| Suggest task approach | ❌ | ✅ | ✅ | ✅ | ✅ |
| Self-assign tasks | ❌ | ❌ | ✅ | ✅ | ✅ |
| Create sub-tasks | ❌ | ❌ | ✅ | ✅ | ✅ |
| Deploy to production | ❌ | ❌ | ❌ | ✅* | ✅ |
| Delegate to other agents | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create new tasks | ❌ | ❌ | ❌ | ❌ | ✅ |
| Modify strategy.md | ❌ | ❌ | ❌ | ❌ | ✅* |
| Spend budget >$10/day | ❌ | ❌ | ❌ | ❌ | ✅* |

`*` = з обов'язковим записом в decision log

### 4.3 Escalation Protocol

```
Agent detects blocker
  → Attempts self-resolution (max 3 retries, 15 min)
  → Escalates to peer agent (if capable)
  → Escalates to manager (CTO agent)
  → Escalates to human (CEO via Telegram/Web)
  → Emergency: pauses task, notifies all stakeholders
```

---

## 5. Task Engine v2

### 5.1 Task Lifecycle

```
CREATED → PLANNING → READY → ASSIGNED → IN_PROGRESS → REVIEW → COMPLETED
                                  ↓                        ↓
                              BLOCKED ←──────────────── REJECTED
                                  ↓
                              ESCALATED
                                  ↓
                              CANCELLED
```

### 5.2 Auto-Assignment Algorithm

```python
def assign_task(task):
    candidates = get_agents_with_capability(task.required_capabilities)
    candidates = filter_available(candidates)  # not overloaded
    candidates = filter_budget(candidates)      # within budget
    
    scored = []
    for agent in candidates:
        score = (
            capability_match(agent, task) * 0.4 +
            current_workload_score(agent) * 0.2 +
            historical_performance(agent, task.type) * 0.3 +
            cost_efficiency(agent) * 0.1
        )
        scored.append((agent, score))
    
    best = max(scored, key=lambda x: x[1])
    
    if best.score > THRESHOLD:
        assign(task, best.agent)
        log_decision('auto_assign', reason=f'Score {best.score}')
    else:
        escalate_to_human(task, reason='No suitable agent found')
```

### 5.3 Workflow Engine

Приклад workflow "Feature Development":

```yaml
name: feature-development
trigger: manual
steps:
  - name: plan
    assignee_capability: architecture
    template: "Analyze requirements and create technical plan for: {feature_description}"
    outputs: [technical_plan]
    
  - name: implement
    assignee_capability: code:{language}
    depends_on: [plan]
    template: "Implement based on plan: {technical_plan}"
    outputs: [pull_request_url]
    
  - name: review
    assignee_capability: code_review
    depends_on: [implement]
    template: "Review PR: {pull_request_url}"
    outputs: [review_result]
    review_required: true  # human approval point
    
  - name: test
    assignee_capability: qa
    depends_on: [review]
    template: "Test feature: {pull_request_url}"
    outputs: [test_report]
    
  - name: deploy
    assignee_capability: devops
    depends_on: [test]
    template: "Deploy to production"
    requires_approval: true  # human gate
```

---

## 6. Intelligence Engine

### 6.1 Daily Brief (auto-generated)

Щодня о 9:00 CEO отримує:

```markdown
## 📊 Morning Brief — Feb 12, 2026

### System Health: 🟢 92/100

### Overnight Activity
- CLAUDE deployed auth microservice (23:15)
- QA completed regression tests (01:30) — 2 minor issues found
- CODE fixed responsive layout (02:45)

### Today's Focus
- 🔴 3 tasks overdue (avg 2 days late)
- 🟡 Budget: $45.20 / $100 daily limit (45%)
- 🟢 All agents healthy, CTO last active 1h ago

### Decisions Needed
1. Approve deploy of payment integration? [Yes/No]
2. CODE requests access to production DB [Approve/Deny]

### Predictions
- Feature X will be ~2 days late (blocker: API design unclear)
- Monthly token cost trending to $1,200 (budget: $1,000)

### Recommendations
1. Move CLAUDE to claude-haiku for routine tasks (-40% cost)
2. Consider hiring a human frontend dev (CODE bottlenecked)
```

### 6.2 Anomaly Detection

Моніторимо:
- Агент не відповідає >30 хв при active статусі
- Token consumption spike (>3x average)
- Повторні помилки одного типу
- Задачі що блокуються циклічно
- Деплої що ламають health checks
- Budget overrun per agent/project

### 6.3 Performance Scoring

```
Agent Score = weighted average of:
  - Task completion rate (20%)
  - Average time to complete (20%)
  - Code quality (automated review scores) (15%)
  - Bug rate (tasks returned from QA) (15%)
  - Cost efficiency (tokens per task) (15%)
  - Collaboration (helps unblock others) (10%)
  - Innovation (proposes improvements) (5%)
```

---

## 7. Frontend v2

### 7.1 New Pages

| Page | Description |
|------|-------------|
| `/dashboard` | CEO overview — health score, daily brief, decisions queue |
| `/workflows` | Visual workflow builder (drag-n-drop) |
| `/costs` | Budget tracking per agent/project/model |
| `/decisions` | Decision log + pending approvals |
| `/chat` | Unified chat with agents (like Slack, channels per project) |
| `/memory` | Browse agent memories, knowledge graph visualization |
| `/settings/sla` | SLA configuration |
| `/settings/autonomy` | Agent autonomy levels |
| `/reports` | Auto-generated weekly/monthly reports |

### 7.2 CEO Dashboard (нова головна)

```
┌─────────────────────────────────────────────────┐
│  Health: 92/100   Budget: $45/$100   Active: 4  │
├─────────────────────┬───────────────────────────┤
│ DECISIONS NEEDED    │  DAILY BRIEF              │
│ • Approve deploy    │  • 3 tasks completed      │
│ • Budget increase?  │  • 1 blocker resolved     │
│ • New hire?         │  • Est. weekly cost: $280  │
├─────────────────────┼───────────────────────────┤
│ AGENT STATUS        │  PROJECT HEALTH           │
│ ◉ CTO  Working     │  Dashboard  ████░ 80%     │
│ ◉ CLAUDE Working   │  API v2     ██░░░ 40%     │
│ ○ CODE  Idle       │  Bot        █████ 100%    │
│ ◉ QA   Testing     │                           │
├─────────────────────┴───────────────────────────┤
│ LIVE FEED                                       │
│ 10:15 CLAUDE: Deployed auth service ✅          │
│ 10:12 QA: Test suite passed (94/94) ✅          │
│ 10:08 CTO: Assigned task #45 to CODE            │
│ 09:55 CODE: PR #23 ready for review             │
└─────────────────────────────────────────────────┘
```

### 7.3 Chat (Agent Communication)

Slack-подібний інтерфейс:
- Channels: `#general`, `#project-dashboard`, `#deployments`, `#incidents`
- Direct messages: CEO ↔ CTO, CTO ↔ CLAUDE, etc.
- Thread replies
- File/code sharing
- Mentions (@CLAUDE, @all-agents)
- Reactions
- Bot commands: `/status`, `/assign`, `/deploy`, `/cost`

---

## 8. API v2

### 8.1 Нові endpoints

```
# Agent Runtime
POST   /api/v2/agents/:id/execute     — запустити задачу на агенті
POST   /api/v2/agents/:id/memory      — додати memory entry
GET    /api/v2/agents/:id/memory      — отримати relevant memories
DELETE /api/v2/agents/:id/memory/:mid  — видалити memory
GET    /api/v2/agents/:id/costs       — витрати агента
PATCH  /api/v2/agents/:id/autonomy    — змінити рівень автономії

# Task Engine
POST   /api/v2/tasks/:id/assign       — auto-assign або manual
POST   /api/v2/tasks/:id/dependencies — додати залежність
GET    /api/v2/tasks/graph             — DAG всіх задач
POST   /api/v2/tasks/:id/retry        — перезапустити
POST   /api/v2/tasks/:id/escalate     — ескалювати

# Workflows
GET    /api/v2/workflows               — список workflows
POST   /api/v2/workflows               — створити workflow
POST   /api/v2/workflows/:id/run       — запустити workflow
GET    /api/v2/workflows/:id/runs      — історія запусків

# Intelligence
GET    /api/v2/intelligence/brief       — daily brief
GET    /api/v2/intelligence/anomalies   — поточні anomalies
GET    /api/v2/intelligence/forecast    — predictions
GET    /api/v2/intelligence/costs       — cost breakdown

# Decisions
GET    /api/v2/decisions/pending        — що потребує рішення
POST   /api/v2/decisions/:id/resolve    — прийняти рішення
GET    /api/v2/decisions/log            — історія рішень

# Notifications
GET    /api/v2/notifications            — мої нотифікації
PATCH  /api/v2/notifications/:id/read   — позначити прочитаним
POST   /api/v2/notifications/settings   — налаштування каналів

# Chat
GET    /api/v2/chat/channels            — список каналів
POST   /api/v2/chat/channels            — створити канал
GET    /api/v2/chat/channels/:id/messages
POST   /api/v2/chat/channels/:id/messages
WS     /api/v2/chat/ws                  — real-time WebSocket
```

### 8.2 Webhook System

```
POST /api/v2/webhooks           — register webhook
DELETE /api/v2/webhooks/:id

Events:
- task.created, task.assigned, task.completed, task.blocked
- agent.status_changed, agent.budget_exceeded
- project.health_changed, project.milestone_reached
- deploy.started, deploy.succeeded, deploy.failed
- decision.needed, decision.made
```

---

## 9. Security v2

### 9.1 Authentication
- **JWT** з refresh tokens для людей
- **API Keys** з scopes для агентів
- **OAuth 2.0** для зовнішніх інтеграцій
- **2FA** для CEO/admin дій (deploy approve, budget changes)

### 9.2 Authorization (RBAC)

```
Roles:
  CEO      — full access
  CTO      — technical admin, agent management
  Manager  — project management, task assignment
  Agent    — scoped to capabilities + assigned tasks
  Viewer   — read-only
  
Permissions:
  agents:read, agents:write, agents:admin
  tasks:read, tasks:write, tasks:assign, tasks:approve
  projects:read, projects:write, projects:admin
  deploy:request, deploy:approve
  budget:read, budget:write
  decisions:read, decisions:make
```

### 9.3 Audit Trail
- **Кожна дія** логується в immutable audit log
- Agent decisions include reasoning chain
- Cost tracking per action
- Data retention: 1 year minimum

---

## 10. Infrastructure v2

### 10.1 Deployment

```
Production:
  - 2x App servers (API + Workers) — 4 vCPU, 8GB RAM
  - 1x PostgreSQL (managed, daily backups)
  - 1x Redis (managed, for cache + pub/sub + queues)
  - 1x S3-compatible storage (file uploads, backups)
  - CDN for frontend (Cloudflare/Vercel)
  - Domain: orkwork.ai (or similar)

Staging:
  - Mirror of production (smaller instances)
  - Auto-deploy on PR merge to develop branch
```

### 10.2 CI/CD Pipeline

```
Push to feature branch
  → Lint + Type check
  → Unit tests
  → Build
  → Deploy to preview URL
  
PR merge to main
  → All above + integration tests
  → QA agent runs automated audit
  → Deploy to staging
  → Smoke tests
  → [Manual gate: CEO approve]
  → Deploy to production
  → Health check
  → Notify team
```

### 10.3 Monitoring

- **Uptime Kuma** — endpoint monitoring (вже є)
- **Prometheus + Grafana** — metrics (API latency, DB queries, agent activity)
- **Structured logging** — JSON logs with correlation IDs
- **Error tracking** — Sentry or equivalent
- **Cost monitoring** — custom dashboard for token/compute costs

---

## 11. Migration Plan (v1 → v2)

### Phase 1: Foundation (2 weeks)
- [ ] HTTPS + domain setup
- [ ] JWT auth system (replace simple token)
- [ ] RBAC implementation
- [ ] New DB tables (migrations)
- [ ] API v2 namespace (`/api/v2/`)
- [ ] Retire coordinator server.js → consolidated in Hono

### Phase 2: Task Engine (2 weeks)
- [ ] Task dependencies (DAG)
- [ ] Auto-assignment algorithm
- [ ] Workflow engine (basic)
- [ ] SLA rules
- [ ] Escalation protocol

### Phase 3: Intelligence (2 weeks)
- [ ] Cost tracking
- [ ] Daily brief generator
- [ ] Performance scoring
- [ ] Anomaly detection (basic rules)
- [ ] Decision log

### Phase 4: Agent Runtime (2 weeks)
- [ ] Agent memory system
- [ ] Capabilities registry
- [ ] Autonomy levels
- [ ] Tool system
- [ ] Health monitoring + auto-restart

### Phase 5: Frontend v2 (3 weeks)
- [ ] New CEO dashboard
- [ ] Chat system (Slack-like)
- [ ] Workflow visual builder
- [ ] Cost dashboard
- [ ] Decision queue UI
- [ ] Mobile responsive (PWA)

### Phase 6: Integrations (2 weeks)
- [ ] Slack adapter
- [ ] Email notifications
- [ ] GitHub deeper integration (auto PR review)
- [ ] Webhook system
- [ ] External API marketplace

### Phase 7: Polish & Launch (1 week)
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation
- [ ] Onboarding flow for new companies
- [ ] Landing page

**Total: ~14 weeks (3.5 months)**

---

## 12. Success Metrics

| Metric | v1 Current | v2 Target |
|--------|-----------|-----------|
| Task auto-assignment rate | 0% | >70% |
| Avg task completion time | unknown | tracked, -30% over 3 months |
| Agent uptime | unmeasured | >99% |
| CEO daily decision load | ~20 decisions | <5 (rest automated) |
| Cost per task | unknown | tracked, optimized |
| Security score | 7/10 | 9.5/10 |
| Mobile usability | 0% | full PWA |
| Onboarding time (new agent) | manual | <5 minutes |

---

## 13. Open Questions

1. **Self-hosting vs SaaS?** — v2 для нас, але структура дозволяє SaaS в майбутньому
2. **Which LLM for Intelligence Engine?** — Claude Sonnet for cost-efficiency? GPT-4o for speed?
3. **Multi-tenancy?** — один інстанс на компанію, чи shared?
4. **Agent marketplace?** — дозволити стороннім створювати агентів?
5. **Pricing model?** — якщо SaaS: per-agent, per-task, or flat?

---

## 14. Competitive Landscape

| Product | Focus | What we do better |
|---------|-------|-------------------|
| CrewAI | Agent orchestration framework | We're full platform, not just framework |
| AutoGen | Multi-agent conversations | We add project/task/budget management |
| Devin | AI software engineer | We manage teams of agents + humans |
| Linear | Project management | We're AI-native, not AI-added |
| Slack | Team communication | We integrate agents as first-class citizens |

**orkwork's unique position:** The first **AI-native company OS** where agents and humans are equal team members with shared workflows, budgets, and accountability.

---

*This spec is a living document. Updated by CTO (Mister Boss) on 2026-02-11.*
*Next review: after CEO feedback.*
