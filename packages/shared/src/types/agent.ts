export type AgentType = "claude_code" | "custom" | "external";

export type AgentStatus = "active" | "idle" | "working" | "error";

export type AgentPermission =
  | "repo:read"
  | "repo:write"
  | "repo:deploy"
  | "strategy:read"
  | "strategy:write"
  | "task:read"
  | "task:write"
  | "task:complete"
  | "employee:notify";

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  apiKeyPrefix: string;
  permissions: AgentPermission[];
  status: AgentStatus;
  currentTaskId: string | null;
  currentProjectId: string | null;
  lastHeartbeat: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentInput {
  name: string;
  type: AgentType;
  permissions?: AgentPermission[];
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  name?: string;
  permissions?: AgentPermission[];
  status?: AgentStatus;
  currentTaskId?: string | null;
  currentProjectId?: string | null;
  metadata?: Record<string, unknown>;
}
