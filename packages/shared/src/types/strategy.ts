export interface StrategyChange {
  id: string;
  projectId: string;
  authorType: "agent" | "employee" | "ceo";
  authorId: string;
  authorName: string;
  diff: string;
  commitSha: string;
  summary: string;
  timestamp: Date;
}

export interface StrategyTask {
  task: string;
  assignee: string;
  status: string;
  priority: string;
  notes: string;
}

export interface StrategyDocument {
  currentObjective: string;
  activeTasks: StrategyTask[];
  architectureDecisions: string[];
  coordinationRules: string[];
  blockers: string[];
  changeLog: string[];
}
