export type EmployeeStatus = "active" | "inactive";

export interface Employee {
  id: string;
  name: string;
  role: string;
  telegramChatId: string | null;
  telegramUsername: string | null;
  email: string | null;
  apiKeyPrefix: string | null;
  assignedProjectIds: string[];
  status: EmployeeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmployeeInput {
  name: string;
  role: string;
  telegramUsername?: string;
  email?: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  role?: string;
  telegramChatId?: string | null;
  telegramUsername?: string | null;
  email?: string | null;
  status?: EmployeeStatus;
  assignedProjectIds?: string[];
}
