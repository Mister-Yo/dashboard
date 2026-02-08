# Strategy: AI-Centric Company + Personal Effectiveness System

## Purpose
Build a "portal of the future" for a human manager that gradually transfers
operational tasks to AI agents. The system combines:
1) Company management (projects, employees, agents, status, performance).
2) Personal effectiveness (knowledge base + task capture + execution tracking).

## Operating Rules (Must Follow)
- Before any deployment or new task, read this file and check changes.
- All changes in this file must include the author tag (e.g., "Author: CODE").
- Multiple agents work under one GitHub account and coordinate via this file.
- Each project must have its own `strategy.md` that is shared with all members.

## Vision
Create a single management cockpit where the CEO can see:
- All projects and their current status, blockers, achievements, and risks.
- All employees (human + agent), who is doing what, and performance trends.
- A controller agent that continuously evaluates effectiveness and suggests actions.

## Core Product Scope (MVP)
### Company Management
- Create employees (human/agent) and issue API keys.
- Create projects with description, repo URL, and docs location.
- Add members (human/agent) to projects and instantly share project strategy.
- View a large board with all projects + all employees and activity summary.

### Personal Effectiveness
- Capture knowledge from Obsidian, Telegram, and Twitter/X.
- Capture tasks for the CEO and assign tasks to agents/employees.
- Store all inputs in a searchable knowledge base.

## Integrations (Required)
- Obsidian: knowledge ingestion (MVP: import markdown or sync from a vault repo).
- Telegram: bot for tasks + knowledge ingestion + human-agent communication.
- Twitter/X: manual sharing of posts/links into the knowledge base.

## System Architecture (Initial)
- Frontend + API: Next.js (App Router) + TypeScript.
- Database: Postgres + Prisma + pgvector for semantic search.
- Queue/Workers: Redis + BullMQ for background jobs.
- Storage: S3-compatible for files and media.

## Core Data Model (MVP)
- Employee (type: human/agent, name, role, status, contacts).
- ApiKey (employee_id, prefix, hash, created_at, revoked_at).
- Project (name, description, repo_url, docs_path, status).
- ProjectMember (project_id, employee_id, role).
- Task (project_id, assignee_id, status, priority, due_at, blockers).
- StatusReport (project_id, author_id, period, achievements, problems, blockers).
- KnowledgeItem (source, content, tags, links, embedding, owner_id).
- ActivityLog (actor_id, type, payload, timestamp).

## Parallel Workstreams (Run in Parallel)
### Track A — Core Panel
- CRUD for employees, API keys, projects, members.
- Global board with project and employee status.
- Status reports and blockers tracking.

### Track B — Knowledge Base
- Telegram ingestion (bot -> KnowledgeItem).
- Twitter/X ingestion (manual submit -> KnowledgeItem).
- Obsidian ingestion (markdown import or vault sync).
- Semantic search over knowledge.

### Track C — Controller Agent
- Periodic activity checks and effectiveness scoring.
- Detection of stalled projects and overloaded employees.
- Actionable recommendations to the CEO.

## Collaboration Protocol (Multi-Agent + Humans)
### Idea to Execution Flow
1) Idea captured and expanded into a written brief.
2) Agents discuss and agree who owns the planning step.
3) Owner produces a detailed plan and raises questions.
4) Plan is обсужден in the same chat and finalized.
5) Convert plan into a detailed pipeline of tasks.
6) Agents and humans claim tasks and execute.

### Task Ownership Rules
- Every agent and person has a specialization.
- Tasks must be claimed only by matching specialization.
- Each human can assign tasks to their own agents.
- Agents may not self-assign outside specialization without approval.

### Task Assignment Mechanics
- Tasks are claimed via the coordination chat or task board.
- Claimed tasks have an explicit owner and status.
- If blocked, owner posts blocker and requests help in chat.
- Controller agent monitors coverage and reassigns when needed.

## MVP Acceptance Criteria
- Create employee and issue API key (show full key only once).
- Create project with repo URL and docs path.
- Add member to project and auto-share project `strategy.md`.
- Board shows current status, blockers, achievements.
- Telegram message appears in the knowledge base.
- Controller agent generates a weekly effectiveness report.

## Project Strategy Standard
For every project repo:
- Have a `strategy.md` at repo root.
- Include project goals, scope, roles, and workflows.
- When a member joins, they receive the project strategy immediately.

## Change Log
- 2026-02-07: Initial strategy draft. Author: CODE
- 2026-02-08: Added collaboration protocol and task assignment rules. Author: CODE
