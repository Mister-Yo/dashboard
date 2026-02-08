export type ProjectStatus = "active" | "paused" | "completed" | "blocked";

export type BlockerSeverity = "low" | "medium" | "high" | "critical";

export interface Blocker {
  id: string;
  description: string;
  severity: BlockerSeverity;
  reportedBy: string;
  reportedAt: Date;
  resolvedAt: Date | null;
}

export interface Achievement {
  id: string;
  description: string;
  achievedBy: string;
  achievedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  githubRepo: string;
  githubBranch: string;
  strategyPath: string;
  status: ProjectStatus;
  assignedAgentIds: string[];
  assignedEmployeeIds: string[];
  blockers: Blocker[];
  achievements: Achievement[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  githubRepo: string;
  githubBranch?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  assignedAgentIds?: string[];
  assignedEmployeeIds?: string[];
}
