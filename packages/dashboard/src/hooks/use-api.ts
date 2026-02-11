import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ─── Types ─────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  currentProjectId: string | null;
  currentTaskId: string | null;
  lastHeartbeat: string | null;
  managerId: string | null;
  apiKeyPrefix: string | null;
  permissions: string[];
}

interface Employee {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  managerId: string | null;
  assignedProjectIds: string[];
  telegramUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  githubRepo: string;
  githubBranch: string;
  strategyPath: string;
  assignedAgentIds: string[];
  assignedEmployeeIds: string[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  assigneeType: string;
  assigneeId: string;
  delegatedBy: string;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  url: string | null;
  content: string;
  summary: string | null;
  tags: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Query Hooks ───────────────────────────────────────

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => apiFetch("/api/agents"),
  });
}

export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => apiFetch("/api/employees"),
  });
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => apiFetch("/api/projects"),
  });
}

export function useTasks(filters?: { projectId?: string; status?: string; assigneeId?: string }) {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.assigneeId) params.set("assigneeId", filters.assigneeId);
  const qs = params.toString();

  return useQuery<Task[]>({
    queryKey: ["tasks", filters],
    queryFn: () => apiFetch(`/api/tasks${qs ? `?${qs}` : ""}`),
  });
}

export function useKnowledge(search?: string, source?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (source) params.set("source", source);
  const qs = params.toString();

  return useQuery<KnowledgeEntry[]>({
    queryKey: ["knowledge", search, source],
    queryFn: () => apiFetch(`/api/knowledge${qs ? `?${qs}` : ""}`),
  });
}

// ─── Mutation Hooks ────────────────────────────────────

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Task>) =>
      apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Task> & { id: string }) =>
      apiFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Project>) =>
      apiFetch("/api/projects", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Agent>) =>
      apiFetch("/api/agents", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useCreateKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<KnowledgeEntry>) =>
      apiFetch("/api/knowledge", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge"] }),
  });
}

// ─── Strategy Changes ────────────────────────────────

interface StrategyChange {
  id: string;
  projectId: string;
  authorType: string;
  authorId: string;
  authorName: string;
  diff: string;
  commitSha: string | null;
  summary: string;
  timestamp: string;
}

export function useStrategyChanges(projectId: string) {
  return useQuery<StrategyChange[]>({
    queryKey: ["strategy-changes", projectId],
    queryFn: () => apiFetch(`/api/projects/${projectId}/strategy-changes`),
    enabled: !!projectId,
  });
}

// ─── Knowledge Hybrid Search ─────────────────────────

type SearchMode = "hybrid" | "semantic" | "keyword";

interface SearchResult {
  results: KnowledgeEntry[];
  method: string;
  meta?: { keywordHits: number; semanticHits: number; fusedCount: number };
}

export function useKnowledgeSearch(query: string, mode: SearchMode = "hybrid") {
  return useQuery<SearchResult>({
    queryKey: ["knowledge-search", query, mode],
    queryFn: () =>
      apiFetch(`/api/knowledge/search?q=${encodeURIComponent(query)}&mode=${mode}`),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });
}

// ─── Activity Hooks ──────────────────────────────────

interface WorkEntity {
  id: string;
  name: string;
  entityType: "agent" | "employee";
  workStatus: "working" | "idle" | "off" | "waiting";
  role?: string;
  type?: string;
  currentTaskId?: string | null;
  currentTaskDescription?: string | null;
  lastHeartbeat?: string | null;
}

interface ActivityEvent {
  id: string;
  actorType: string;
  actorId: string;
  actorName: string;
  eventType: string;
  title: string;
  description: string;
  projectId: string | null;
  taskId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ActivityStatusResponse {
  agents: WorkEntity[];
  employees: WorkEntity[];
}

export function useActivityStatus() {
  return useQuery<ActivityStatusResponse>({
    queryKey: ["activity", "status"],
    queryFn: () => apiFetch("/api/activity/status"),
  });
}

export function useActivityEvents(limit = 50) {
  return useQuery<ActivityEvent[]>({
    queryKey: ["activity", "events"],
    queryFn: () => apiFetch(`/api/activity?limit=${limit}`),
  });
}

// ─── Admin Mutation Hooks ────────────────────────────

export function useApproveEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/employees/${id}/approve`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useRejectEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/employees/${id}/reject`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: string }) =>
      apiFetch(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

// ─── Coordination Hooks ─────────────────────────────

interface CoordThread {
  id: string;
  projectId: string | null;
  taskId: string | null;
  threadType: string;
  isDirectMessage: boolean;
  participantIds: string[];
  title: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface CoordMessage {
  id: string;
  threadId: string;
  senderId: string | null;
  messageType: string;
  payload: Record<string, unknown> | null;
  replyTo: string | null;
  createdAt: string;
}

export function useCoordThreads() {
  return useQuery<CoordThread[]>({
    queryKey: ["coord-threads"],
    queryFn: () => apiFetch("/api/coord"),
  });
}

export function useCoordMessages(threadId: string | null) {
  return useQuery<CoordMessage[]>({
    queryKey: ["coord-messages", threadId],
    queryFn: () => apiFetch(`/api/coord/messages?thread_id=${threadId}`),
    enabled: !!threadId,
  });
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation<CoordThread, Error, { title: string; thread_type?: string; project_id?: string; task_id?: string }>({
    mutationFn: (data) =>
      apiFetch("/api/coord", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coord-threads"] }),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { thread_id: string; message_type?: string; payload?: Record<string, unknown>; sender_id?: string }) =>
      apiFetch("/api/coord/messages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coord-messages"] }),
  });
}

// ─── DM Thread Hook ─────────────────────────────────

export function useDMThread(participantId: string | null) {
  return useQuery<CoordThread & { isDirectMessage: boolean; participantIds: string[] }>({
    queryKey: ["dm-thread", participantId],
    queryFn: () => apiFetch(`/api/coord/dm/${participantId}`),
    enabled: !!participantId,
  });
}

// ─── Analytics Hook ─────────────────────────────────

interface AnalyticsSummary {
  tasksCompletedByDay: { date: string; count: number }[];
  tasksByStatus: { status: string; count: number }[];
  tasksByPriority: { priority: string; count: number }[];
  agentUtilization: {
    agent_name: string;
    work_status: string;
    agent_status: string;
    tasks_completed: number;
    tasks_active: number;
  }[];
  avgCompletionTimeByWeek: { week: string; avg_hours: number }[];
  blockersByWeek: { week: string; count: number }[];
}

export function useAnalytics() {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics"],
    queryFn: () => apiFetch("/api/analytics/summary"),
    staleTime: 60_000,
  });
}

// ─── GitHub Activity Hook ───────────────────────────

interface GitHubActivity {
  commits: { sha: string; message: string; author: string; date: string; url: string }[];
  issues: { number: number; title: string; state: string; createdAt: string; url: string }[];
  pullRequests: { number: number; title: string; state: string; createdAt: string; url: string; draft: boolean }[];
}

export function useGitHubActivity(projectId: string | null) {
  return useQuery<GitHubActivity>({
    queryKey: ["github-activity", projectId],
    queryFn: () => apiFetch(`/api/github/projects/${projectId}/activity`),
    enabled: !!projectId,
    staleTime: 120_000,
    retry: false,
  });
}
