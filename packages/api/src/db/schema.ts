import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  varchar,
  boolean,
  integer,
  real,
  pgEnum,
  customType,
} from "drizzle-orm/pg-core";

// Custom type for pgvector
const vector = customType<{ data: number[]; driverData: string; notNull: false }>({
  dataType() {
    return "vector(1024)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value) as number[];
  },
});

// --- Enums ---

export const agentTypeEnum = pgEnum("agent_type", [
  "claude_code",
  "codex",
  "qa",
  "custom",
  "external",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "idle",
  "working",
  "error",
]);

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "inactive",
  "pending",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "paused",
  "completed",
  "blocked",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "review",
  "completed",
  "blocked",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const assigneeTypeEnum = pgEnum("assignee_type", [
  "agent",
  "employee",
  "ceo",
]);

export const apiKeyOwnerTypeEnum = pgEnum("api_key_owner_type", [
  "agent",
  "employee",
]);

export const knowledgeSourceEnum = pgEnum("knowledge_source", [
  "telegram",
  "twitter",
  "manual",
  "agent",
  "email",
]);

export const blockerSeverityEnum = pgEnum("blocker_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const evaluationPeriodEnum = pgEnum("evaluation_period", [
  "daily",
  "weekly",
  "monthly",
]);

export const evaluationSubjectTypeEnum = pgEnum("evaluation_subject_type", [
  "agent",
  "employee",
  "project",
]);

export const workStatusEnum = pgEnum("work_status", [
  "working",
  "idle",
  "off",
  "waiting",
]);

export const activityEventTypeEnum = pgEnum("activity_event_type", [
  "start_task",
  "finish_task",
  "status_change",
  "note",
  "blocker",
  "deploy",
  "commit",
  "review",
]);

// --- Tables ---

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: agentTypeEnum("type").notNull(),
  apiKeyHash: text("api_key_hash").notNull(),
  apiKeyPrefix: varchar("api_key_prefix", { length: 16 }).notNull(),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  status: agentStatusEnum("status").default("idle").notNull(),
  workStatus: workStatusEnum("work_status").default("idle").notNull(),
  currentTaskId: uuid("current_task_id"),
  currentProjectId: uuid("current_project_id"),
  lastHeartbeat: timestamp("last_heartbeat"),
  managerId: uuid("manager_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 255 }).notNull(),
  telegramChatId: varchar("telegram_chat_id", { length: 64 }),
  telegramUsername: varchar("telegram_username", { length: 255 }),
  email: varchar("email", { length: 255 }),
  passwordHash: text("password_hash"),
  apiKeyHash: text("api_key_hash"),
  apiKeyPrefix: varchar("api_key_prefix", { length: 16 }),
  assignedProjectIds: jsonb("assigned_project_ids").$type<string[]>().default([]),
  status: employeeStatusEnum("status").default("active").notNull(),
  workStatus: workStatusEnum("work_status").default("idle").notNull(),
  managerId: uuid("manager_id"),
  currentTaskDescription: text("current_task_description"),
  githubId: varchar("github_id", { length: 64 }),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull().default(""),
  githubRepo: varchar("github_repo", { length: 255 }).notNull(),
  githubBranch: varchar("github_branch", { length: 255 }).notNull().default("main"),
  strategyPath: varchar("strategy_path", { length: 512 }).notNull().default("strategy.md"),
  status: projectStatusEnum("status").default("active").notNull(),
  assignedAgentIds: jsonb("assigned_agent_ids").$type<string[]>().default([]),
  assignedEmployeeIds: jsonb("assigned_employee_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blockers = pgTable("blockers", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  description: text("description").notNull(),
  severity: blockerSeverityEnum("severity").notNull().default("medium"),
  reportedBy: varchar("reported_by", { length: 255 }).notNull(),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  description: text("description").notNull(),
  achievedBy: varchar("achieved_by", { length: 255 }).notNull(),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull().default(""),
  projectId: uuid("project_id").references(() => projects.id),
  assigneeType: assigneeTypeEnum("assignee_type").notNull(),
  assigneeId: varchar("assignee_id", { length: 255 }).notNull(),
  delegatedBy: varchar("delegated_by", { length: 255 }).notNull(),
  status: taskStatusEnum("status").default("pending").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  parentTaskId: uuid("parent_task_id"),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerType: apiKeyOwnerTypeEnum("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  scopes: jsonb("scopes").$type<string[]>().default([]),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeEntries = pgTable("knowledge_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  url: text("url"),
  content: text("content").notNull(),
  summary: text("summary").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().default([]),
  source: knowledgeSourceEnum("source").notNull(),
  sourceMessageId: varchar("source_message_id", { length: 255 }),
  embedding: vector("embedding"),
  parentEntryId: uuid("parent_entry_id"),
  chunkIndex: integer("chunk_index"),
  searchVector: text("search_vector"), // tsvector managed by DB trigger
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const strategyChanges = pgTable("strategy_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  authorType: varchar("author_type", { length: 50 }).notNull(),
  authorId: varchar("author_id", { length: 255 }).notNull(),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  diff: text("diff").notNull(),
  commitSha: varchar("commit_sha", { length: 40 }),
  summary: text("summary").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const performanceEvaluations = pgTable("performance_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: evaluationSubjectTypeEnum("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  period: evaluationPeriodEnum("period").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  metrics: jsonb("metrics").$type<{
    tasksCompleted: number;
    tasksBlocked: number;
    avgCompletionTimeHours: number;
    strategyAdherence: number;
    codeQuality: number | null;
    communicationScore: number;
  }>().notNull(),
  aiAnalysis: text("ai_analysis").notNull(),
  recommendations: jsonb("recommendations").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Coordinator ---

export const coordThreads = pgTable("coord_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  taskId: uuid("task_id").references(() => tasks.id),
  threadType: varchar("thread_type", { length: 50 }).notNull().default("general"),
  title: varchar("title", { length: 500 }),
  createdBy: varchar("created_by", { length: 255 }),
  isDirectMessage: boolean("is_direct_message").default(false).notNull(),
  participantIds: jsonb("participant_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const coordMessages = pgTable("coord_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => coordThreads.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id", { length: 255 }),
  messageType: varchar("message_type", { length: 50 }).notNull().default("note"),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
  replyTo: uuid("reply_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Activity ---

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: assigneeTypeEnum("actor_type").notNull(),
  actorId: varchar("actor_id", { length: 255 }).notNull(),
  actorName: varchar("actor_name", { length: 255 }).notNull(),
  eventType: activityEventTypeEnum("event_type").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").default(""),
  projectId: uuid("project_id").references(() => projects.id),
  taskId: uuid("task_id").references(() => tasks.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
