export type EvaluationSubjectType = "agent" | "employee" | "project";

export type EvaluationPeriod = "daily" | "weekly" | "monthly";

export interface PerformanceMetrics {
  tasksCompleted: number;
  tasksBlocked: number;
  avgCompletionTimeHours: number;
  strategyAdherence: number;
  codeQuality: number | null;
  communicationScore: number;
}

export interface PerformanceEvaluation {
  id: string;
  subjectType: EvaluationSubjectType;
  subjectId: string;
  period: EvaluationPeriod;
  periodStart: Date;
  periodEnd: Date;
  metrics: PerformanceMetrics;
  aiAnalysis: string;
  recommendations: string[];
  createdAt: Date;
}
