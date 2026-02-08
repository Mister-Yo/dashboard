# Coordinator API (Draft)

## Goals
Provide a single coordination layer for humans and agents:
1) Register agents and track specializations and health.
2) Create and route tasks by specialization.
3) Provide a shared chat for planning and execution.
4) Enforce task claiming rules with leases and heartbeats.

## Auth
- Agents: `Authorization: Bearer <api_key>`
- Humans: session cookie or admin token

## Common Conventions
- IDs are UUIDs.
- Timestamps are ISO 8601 in UTC.
- `status` values use a shared pipeline.

### Task Pipeline Statuses
`backlog` -> `ready` -> `claimed` -> `in_progress` -> `review` -> `done`
`blocked` and `canceled` can be entered from any state.

## Endpoints

### Agents
1. `POST /api/coord/agents/register`
Create or update agent profile.
Request:
```json
{
  "employee_id": "uuid",
  "name": "CLAUDE",
  "endpoint_url": "https://agent-host/api",
  "specialization_codes": ["planning", "backend", "research"],
  "capabilities": {"tools": ["web", "db"], "models": ["claude-3"]},
  "owner_employee_id": "uuid"
}
```
Response:
```json
{"status":"ok","agent_id":"uuid"}
```

2. `POST /api/coord/agents/heartbeat`
Request:
```json
{"employee_id":"uuid","status":"active","metadata":{"load":0.2}}
```
Response:
```json
{"status":"ok","next_heartbeat_sec":60}
```

3. `GET /api/coord/agents`
Query params: `status`, `specialization`, `owner_employee_id`

### Tasks
4. `POST /api/coord/tasks`
Request:
```json
{
  "project_id":"uuid",
  "title":"Design Coordinator API",
  "description":"Create endpoint list and payloads",
  "required_specialization_code":"planning",
  "created_by":"uuid",
  "priority":"P1"
}
```

5. `GET /api/coord/tasks`
Query params: `status`, `project_id`, `specialization`, `assignee_id`

6. `POST /api/coord/tasks/:id/claim`
Request:
```json
{"employee_id":"uuid","lease_ttl_sec":1800}
```
Response:
```json
{"status":"ok","lease_expires_at":"2026-02-08T12:00:00Z"}
```

7. `POST /api/coord/tasks/:id/heartbeat`
Request:
```json
{"employee_id":"uuid"}
```

8. `POST /api/coord/tasks/:id/release`
Request:
```json
{"employee_id":"uuid","reason":"blocked by missing schema"}
```

9. `POST /api/coord/tasks/:id/status`
Request:
```json
{"employee_id":"uuid","status":"blocked","blocker":"Need API schema"}
```

### Coordination Chat
10. `POST /api/coord/messages`
Request:
```json
{
  "thread_id":"uuid",
  "sender_id":"uuid",
  "message_type":"task_update",
  "payload":{"status":"blocked","summary":"Need schema"}
}
```

11. `GET /api/coord/messages`
Query params: `thread_id`, `project_id`, `task_id`, `since`

### Planning and Decisions
12. `POST /api/coord/plans`
Request:
```json
{"project_id":"uuid","title":"Coordinator API Plan","body_markdown":"..."}
```

13. `POST /api/coord/decisions`
Request:
```json
{"project_id":"uuid","title":"Use Next.js","body_markdown":"Why we chose it"}
```

## Behavior Rules
- Claiming a task requires matching specialization.
- A task can have only one active lease at a time.
- Heartbeat extends the lease; missing heartbeat returns task to `ready`.
- Agents may not claim tasks outside their specialization unless `override=true`.
