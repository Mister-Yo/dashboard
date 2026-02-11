"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  useTasks,
  useProjects,
  useAgents,
  useEmployees,
  useCreateTask,
  useUpdateTask,
} from "@/hooks/use-api";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/ui/fade-in";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────── */

type TaskStatus = "pending" | "in_progress" | "review" | "completed" | "blocked";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type AssigneeType = "agent" | "employee" | "ceo";

interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  assigneeType: AssigneeType;
  assigneeId: string;
  delegatedBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface AgentLite {
  id: string;
  name: string;
}

interface EmployeeLite {
  id: string;
  name: string;
}

/* ─── Constants ──────────────────────────────────────── */

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "review",
  "blocked",
  "completed",
];

const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

const STATUS_FLOW: TaskStatus[] = [
  "pending",
  "in_progress",
  "review",
  "blocked",
  "completed",
];

const KANBAN_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "in_progress", label: "In Progress" },
  { status: "review", label: "Review" },
  { status: "blocked", label: "Blocked" },
  { status: "completed", label: "Completed" },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-slate-500/20 text-slate-300",
  medium: "bg-blue-500/20 text-blue-300",
  high: "bg-amber-500/20 text-amber-300",
  urgent: "bg-rose-500/20 text-rose-300",
};

/* ─── Helpers ────────────────────────────────────────── */

function formatTime(value: string | null) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function selectClassName() {
  return cn(
    "w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3 text-sm",
    "text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
  );
}

function nextStatus(current: TaskStatus): TaskStatus {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx >= STATUS_FLOW.length - 1) return current;
  return STATUS_FLOW[idx + 1];
}

/* ─── Root export (Suspense boundary) ────────────────── */

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <SkeletonGrid count={6} />
        </div>
      }
    >
      <TasksPageContent />
    </Suspense>
  );
}

/* ─── Create Task Modal ──────────────────────────────── */

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  agents: AgentLite[];
  employees: EmployeeLite[];
  defaultProjectId: string;
  onCreated: () => void;
}

function CreateTaskModal({
  open,
  onClose,
  projects,
  agents,
  employees,
  defaultProjectId,
  onCreated,
}: CreateTaskModalProps) {
  const createTask = useCreateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [assigneeType, setAssigneeType] = useState<AssigneeType>("ceo");
  const [assigneeId, setAssigneeId] = useState("ceo");
  const [delegatedBy, setDelegatedBy] = useState("CEO");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setProjectId(defaultProjectId);
  }, [defaultProjectId]);

  useEffect(() => {
    if (assigneeType === "ceo") {
      setAssigneeId("ceo");
    } else if (assigneeType === "agent" && agents.length > 0) {
      setAssigneeId((prev) => (prev && prev !== "ceo" ? prev : agents[0].id));
    } else if (assigneeType === "employee" && employees.length > 0) {
      setAssigneeId((prev) => (prev && prev !== "ceo" ? prev : employees[0].id));
    } else {
      setAssigneeId("");
    }
  }, [assigneeType, agents, employees]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setProjectId(defaultProjectId);
    setAssigneeType("ceo");
    setAssigneeId("ceo");
    setDelegatedBy("CEO");
    setPriority("medium");
    setDueDate("");
    setTags("");
    setFormError(null);
  }

  async function handleCreate() {
    setFormError(null);
    try {
      await createTask.mutateAsync({
        title,
        description,
        projectId: projectId || null,
        assigneeType,
        assigneeId,
        delegatedBy,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Create
            </p>
            <h2
              id="create-task-title"
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              New Task
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--card-border)] p-2 text-[var(--muted)] hover:bg-[var(--surface)] transition"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Task title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            placeholder="Delegated by (e.g. CEO)"
            value={delegatedBy}
            onChange={(event) => setDelegatedBy(event.target.value)}
          />

          <div className="md:col-span-2">
            <Textarea
              rows={3}
              placeholder="Description (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <select
            className={selectClassName()}
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            className={selectClassName()}
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
          >
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            className={selectClassName()}
            value={assigneeType}
            onChange={(event) =>
              setAssigneeType(event.target.value as AssigneeType)
            }
          >
            <option value="ceo">ceo</option>
            <option value="agent">agent</option>
            <option value="employee">employee</option>
          </select>

          {assigneeType === "ceo" ? (
            <Input value="ceo" disabled />
          ) : assigneeType === "agent" ? (
            <select
              className={selectClassName()}
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Select agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              className={selectClassName()}
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          )}

          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
          <Input
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </div>

        {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface)] transition"
          >
            Cancel
          </button>
          <Button
            onClick={handleCreate}
            disabled={createTask.isPending || !title.trim() || !assigneeId}
          >
            {createTask.isPending ? "Creating..." : "Create task"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Kanban Task Card ───────────────────────────────── */

interface TaskCardProps {
  task: Task;
  assigneeLabel: string;
  onAdvance: (taskId: string, next: TaskStatus) => void;
}

function TaskCard({ task, assigneeLabel, onAdvance }: TaskCardProps) {
  const next = nextStatus(task.status);
  const isLast = next === task.status;

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3 space-y-2">
      <h4 className="text-sm font-medium leading-tight line-clamp-2">
        {task.title}
      </h4>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
            PRIORITY_COLORS[task.priority]
          )}
        >
          {task.priority}
        </span>
        <span className="text-[10px] text-[var(--muted)] truncate max-w-[100px]">
          {assigneeLabel}
        </span>
      </div>

      {!isLast && (
        <button
          onClick={() => onAdvance(task.id, next)}
          className={cn(
            "w-full rounded-lg border border-[var(--card-border)] px-2 py-1 text-[10px] font-medium",
            "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition"
          )}
        >
          Move to {next.replace("_", " ")}
        </button>
      )}
    </div>
  );
}

/* ─── Main Content ───────────────────────────────────── */

function TasksPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const queryProjectId = searchParams.get("projectId") ?? "";
  const viewParam = searchParams.get("view") ?? "list";
  const isKanban = viewParam === "kanban";

  // ─── React Query data hooks ─────────────────────────────
  const {
    data: rawTasks = [],
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks();
  const { data: rawProjects = [], isLoading: projectsLoading } = useProjects();
  const { data: rawAgents = [], isLoading: agentsLoading } = useAgents();
  const { data: rawEmployees = [], isLoading: employeesLoading } = useEmployees();

  // Cast to local, more specific types
  const tasks = rawTasks as unknown as Task[];
  const projects = rawProjects as unknown as Project[];
  const agents = rawAgents as unknown as AgentLite[];
  const employees = rawEmployees as unknown as EmployeeLite[];

  const loading = tasksLoading || projectsLoading || agentsLoading || employeesLoading;
  const error = tasksError;

  // ─── Mutations ──────────────────────────────────────────
  const updateTask = useUpdateTask();

  // ─── Local UI state ────────────────────────────────────
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!queryProjectId) return;
    setFilterProjectId(queryProjectId);
  }, [queryProjectId]);

  // ─── View toggle ─────────────────────────────────────────
  const setView = useCallback(
    (view: "list" | "kanban") => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === "list") {
        params.delete("view");
      } else {
        params.set("view", view);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // ─── Sorted tasks via useMemo ──────────────────────────
  const sortedTasks = useMemo(() => {
    return [...tasks].sort(
      (x, y) =>
        new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime()
    );
  }, [tasks]);

  const summary = useMemo(() => {
    const total = sortedTasks.length;
    const active = sortedTasks.filter(
      (t) => t.status === "in_progress" || t.status === "review"
    ).length;
    const blocked = sortedTasks.filter((t) => t.status === "blocked").length;
    const done = sortedTasks.filter((t) => t.status === "completed").length;
    return { total, active, blocked, done };
  }, [sortedTasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedTasks.filter((task) => {
      if (filterStatus !== "all" && task.status !== filterStatus) return false;
      if (filterProjectId !== "all" && task.projectId !== filterProjectId) {
        return false;
      }
      if (q) {
        const haystack = `${task.title}\n${task.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sortedTasks, filterStatus, filterProjectId, search]);

  const projectsById = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]));
  }, [projects]);

  const agentsById = useMemo(() => {
    return new Map(agents.map((a) => [a.id, a]));
  }, [agents]);

  const employeesById = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e]));
  }, [employees]);

  function assigneeLabel(task: Task) {
    if (task.assigneeType === "ceo") return "CEO";
    if (task.assigneeType === "agent") {
      return agentsById.get(task.assigneeId)?.name ?? task.assigneeId;
    }
    if (task.assigneeType === "employee") {
      return employeesById.get(task.assigneeId)?.name ?? task.assigneeId;
    }
    return task.assigneeId;
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    try {
      await updateTask.mutateAsync({ id: taskId, status });
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  }

  // ─── Kanban column data ─────────────────────────────────
  const kanbanColumns = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      tasks: filtered.filter((t) => t.status === col.status),
    }));
  }, [filtered]);

  // ─── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-8">
        <SkeletonGrid count={6} />
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────
  if (error) {
    return (
      <ErrorState
        message="Failed to connect to API"
        detail={error instanceof Error ? error.message : "Failed to load tasks"}
        onRetry={() => refetchTasks()}
      />
    );
  }

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* ─── Page Header ─────────────────────────────────── */}
        <PageHeader
          label="Tasks"
          title="Execution Queue"
          description="Capture work, delegate, and track progress across projects."
          stats={[
            { label: "total", value: summary.total, color: "muted" as const },
            { label: "active", value: summary.active, color: "primary" as const },
            { label: "blocked", value: summary.blocked, color: "danger" as const },
            { label: "done", value: summary.done, color: "success" as const },
          ]}
          actions={
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center rounded-full border border-[var(--card-border)] overflow-hidden">
                <button
                  onClick={() => setView("list")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition",
                    !isKanban
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  List
                </button>
                <button
                  onClick={() => setView("kanban")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition",
                    isKanban
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  Kanban
                </button>
              </div>

              {/* Create task button */}
              <Button onClick={() => setCreateModalOpen(true)}>
                <span className="mr-1.5">+</span> New Task
              </Button>
            </div>
          }
        />

        {/* ─── Filters ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className={selectClassName()}
              value={filterStatus}
              onChange={(event) =>
                setFilterStatus(event.target.value as TaskStatus | "all")
              }
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className={selectClassName()}
              value={filterProjectId}
              onChange={(event) => setFilterProjectId(event.target.value)}
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* ─── Content: Kanban or List ─────────────────────── */}
        {isKanban ? (
          /* ── Kanban View ────────────────────────────────── */
          filtered.length === 0 ? (
            <EmptyState
              title="No tasks found"
              description="Try adjusting your filters or create a new task."
              action={
                <Button onClick={() => setCreateModalOpen(true)}>
                  <span className="mr-1.5">+</span> New Task
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {kanbanColumns.map((col) => (
                <div
                  key={col.status}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-3 min-h-[200px]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {col.label}
                    </h3>
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)] tabular-nums">
                      {col.tasks.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {col.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        assigneeLabel={assigneeLabel(task)}
                        onAdvance={handleStatusChange}
                      />
                    ))}

                    {col.tasks.length === 0 && (
                      <p className="text-center text-[10px] text-[var(--muted)] py-6">
                        No tasks
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ── List View ─────────────────────────────────── */
          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  List
                </p>
                <h2 className="text-lg font-semibold">Tasks</h2>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No tasks found"
                description="Try adjusting your filters or create a new task."
                action={
                  <Button onClick={() => setCreateModalOpen(true)}>
                    <span className="mr-1.5">+</span> New Task
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((task) => {
                  const project = task.projectId
                    ? projectsById.get(task.projectId)
                    : null;
                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            Task
                          </p>
                          <h3 className="text-lg font-semibold leading-tight">
                            {task.title}
                          </h3>
                          <p className="text-xs text-[var(--muted)] mt-1">
                            {project ? project.name : "No project"} ·{" "}
                            <span
                              className={cn(
                                "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                                PRIORITY_COLORS[task.priority]
                              )}
                            >
                              {task.priority}
                            </span>
                          </p>
                        </div>
                        <StatusPill status={task.status} />
                      </div>

                      {task.description && (
                        <p className="text-sm text-[var(--muted)] mt-3 line-clamp-3 whitespace-pre-wrap">
                          {task.description}
                        </p>
                      )}

                      <div className="mt-4 grid gap-2 text-xs text-[var(--muted)]">
                        <div className="flex items-center justify-between">
                          <span>Assignee</span>
                          <span className="text-[var(--foreground)]">
                            {task.assigneeType}:{assigneeLabel(task)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Delegated by</span>
                          <span className="text-[var(--foreground)]">
                            {task.delegatedBy}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Due</span>
                          <span className="text-[var(--foreground)]">
                            {formatTime(task.dueDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Updated</span>
                          <span className="text-[var(--foreground)]">
                            {formatTime(task.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <select
                          className={selectClassName()}
                          value={task.status}
                          onChange={(event) =>
                            handleStatusChange(
                              task.id,
                              event.target.value as TaskStatus
                            )
                          }
                        >
                          {STATUS_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </div>

                      {task.tags?.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {task.tags.slice(0, 6).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ─── Create Task Modal ───────────────────────────── */}
        <CreateTaskModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          projects={projects}
          agents={agents}
          employees={employees}
          defaultProjectId={queryProjectId}
          onCreated={() => {}}
        />
      </div>
    </FadeIn>
  );
}
