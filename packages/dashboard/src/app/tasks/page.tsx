"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "review",
  "blocked",
  "completed",
];

const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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

export default function TasksPage() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [assigneeType, setAssigneeType] = useState<AssigneeType>("ceo");
  const [assigneeId, setAssigneeId] = useState("ceo");
  const [delegatedBy, setDelegatedBy] = useState("CEO");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");

  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const projectFromQuery = searchParams.get("projectId");
    if (!projectFromQuery) return;
    setFilterProjectId(projectFromQuery);
    setProjectId(projectFromQuery);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      try {
        const [t, p, a, e] = await Promise.all([
          apiFetch<Task[]>("/api/tasks"),
          apiFetch<Project[]>("/api/projects"),
          apiFetch<AgentLite[]>("/api/agents"),
          apiFetch<EmployeeLite[]>("/api/employees"),
        ]);
        t.sort(
          (x, y) =>
            new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime()
        );
        setTasks(t);
        setProjects(p);
        setAgents(a);
        setEmployees(e);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (assigneeType === "ceo") {
      setAssigneeId("ceo");
    } else if (assigneeType === "agent" && agents.length > 0) {
      setAssigneeId((prev) => prev && prev !== "ceo" ? prev : agents[0].id);
    } else if (assigneeType === "employee" && employees.length > 0) {
      setAssigneeId((prev) => prev && prev !== "ceo" ? prev : employees[0].id);
    } else if (assigneeType !== "ceo") {
      setAssigneeId("");
    }
  }, [assigneeType, agents, employees]);

  const summary = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter(
      (t) => t.status === "in_progress" || t.status === "review"
    ).length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const done = tasks.filter((t) => t.status === "completed").length;
    return { total, active, blocked, done };
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
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
  }, [tasks, filterStatus, filterProjectId, search]);

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

  async function handleCreate() {
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await apiFetch<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
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
        }),
      });
      setTasks((prev) => [created, ...prev]);
      setTitle("");
      setDescription("");
      setProjectId("");
      setAssigneeType("ceo");
      setAssigneeId("ceo");
      setDelegatedBy("CEO");
      setPriority("medium");
      setDueDate("");
      setTags("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to connect to API</p>
          <p className="text-[var(--muted)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Tasks
          </p>
          <h1 className="text-3xl font-semibold">Execution Queue</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Capture work, delegate, and track progress across projects.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summary.total} total
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summary.active} active
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summary.blocked} blocked
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summary.done} done
          </span>
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Create
            </p>
            <h2 className="text-lg font-semibold">New Task</h2>
          </div>
          <Button
            onClick={handleCreate}
            disabled={submitting || !title.trim() || !assigneeId}
          >
            {submitting ? "Creating..." : "Create task"}
          </Button>
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
      </section>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              List
            </p>
            <h2 className="text-lg font-semibold">Tasks</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 w-full sm:w-auto">
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
        </div>

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
                      {project ? project.name : "No project"} · {task.priority}
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

          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-[var(--muted)]">
              No tasks found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
