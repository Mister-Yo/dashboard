# Database Schema (Draft)

## Notes
- Postgres is the primary store.
- UUID primary keys.
- JSONB used for flexible agent capabilities and message payloads.
- Designed to integrate with existing `employees`, `projects`, and `tasks` tables.

## Core Tables (Coordinator Layer)

### agent_profiles
```sql
create table agent_profiles (
  employee_id uuid primary key references employees(id),
  owner_employee_id uuid references employees(id),
  endpoint_url text,
  status text not null default 'inactive',
  last_heartbeat_at timestamptz,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_agent_profiles_owner on agent_profiles(owner_employee_id);
```

### specializations
```sql
create table specializations (
  id uuid primary key,
  code text not null unique,
  name text not null,
  description text
);
```

### employee_specializations
```sql
create table employee_specializations (
  employee_id uuid references employees(id),
  specialization_id uuid references specializations(id),
  primary key (employee_id, specialization_id)
);
```

### coord_threads
```sql
create table coord_threads (
  id uuid primary key,
  project_id uuid references projects(id),
  task_id uuid references tasks(id),
  thread_type text not null, -- project | task | general | idea
  title text,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);
create index idx_coord_threads_project on coord_threads(project_id);
```

### coord_messages
```sql
create table coord_messages (
  id uuid primary key,
  thread_id uuid references coord_threads(id),
  sender_id uuid references employees(id),
  message_type text not null,
  payload jsonb not null,
  reply_to uuid,
  created_at timestamptz not null default now()
);
create index idx_coord_messages_thread on coord_messages(thread_id);
```

### task_claims
```sql
create table task_claims (
  id uuid primary key,
  task_id uuid references tasks(id),
  claimant_id uuid references employees(id),
  status text not null default 'active',
  lease_expires_at timestamptz not null,
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_task_claims_task on task_claims(task_id);
create index idx_task_claims_claimant on task_claims(claimant_id);
```

### task_events
```sql
create table task_events (
  id uuid primary key,
  task_id uuid references tasks(id),
  actor_id uuid references employees(id),
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index idx_task_events_task on task_events(task_id);
```

### plans
```sql
create table plans (
  id uuid primary key,
  project_id uuid references projects(id),
  author_id uuid references employees(id),
  title text not null,
  body_markdown text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
create index idx_plans_project on plans(project_id);
```

### decisions
```sql
create table decisions (
  id uuid primary key,
  project_id uuid references projects(id),
  author_id uuid references employees(id),
  title text not null,
  body_markdown text not null,
  created_at timestamptz not null default now()
);
create index idx_decisions_project on decisions(project_id);
```

## Required Additions to Existing Tables

### tasks
```sql
alter table tasks
  add column required_specialization_id uuid references specializations(id),
  add column current_status text not null default 'backlog';
```

### employees
```sql
alter table employees
  add column manager_id uuid references employees(id);
```

## Integrity Rules
1. A task can have only one active claim at a time.
2. Task claims expire if `last_heartbeat_at` is older than lease TTL.
3. An agent can claim a task only if specialization matches.
4. Humans may assign tasks only to agents they own (via `owner_employee_id`).
