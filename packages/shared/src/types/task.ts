export type TaskStatus = "pending" | "in_progress" | "review" | "completed" | "blocked";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type AssigneeType = "agent" | "employee" | "ceo";

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  assigneeType: AssigneeType;
  assigneeId: string;
  delegatedBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  parentTaskId: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  projectId?: string;
  assigneeType: AssigneeType;
  assigneeId: string;
  priority?: TaskPriority;
  dueDate?: string;
  parentTaskId?: string;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeType?: AssigneeType;
  assigneeId?: string;
  dueDate?: string | null;
  tags?: string[];
}
