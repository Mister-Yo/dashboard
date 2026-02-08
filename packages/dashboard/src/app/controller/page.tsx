"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

type TaskStatus = "pending" | "in_progress" | "review" | "completed" | "blocked";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface Agent {
  id: string;
  name: string;
  status: string;
  currentProjectId: string | null;
  currentTaskId: string | null;
  lastHeartbeat: string | null;
}

interface ProjectLite {
  id: string;
  name: string;
  status: string;
}

interface TaskLite {
  id: string;
  title: string;
  projectId: string | null;
  assigneeType: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  updatedAt: string;
}

const STALE_MINUTES = 15;
const REFRESH_MS = 20000;

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

function minutesAgo(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / 60000);
}

export default function ControllerPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const [a, t, p] = await Promise.all([
          apiFetch<Agent[]>("/api/agents"),
          apiFetch<TaskLite[]>("/api/tasks"),
          apiFetch<ProjectLite[]>("/api/projects"),
        ]);
        t.sort(
          (x, y) =>
            new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime()
        );
        setAgents(a);
        setTasks(t);
        setProjects(p);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    load();
    timer = setInterval(load, REFRESH_MS);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const derived = useMemo(() => {
    const staleCutoff = Date.now() - STALE_MINUTES * 60 * 1000;
    const staleAgents = agents.filter((a) => {
      if (!a.lastHeartbeat) return true;
      const time = new Date(a.lastHeartbeat).getTime();
      if (Number.isNaN(time)) return true;
      return time < staleCutoff;
    });

    const blockedTasks = tasks.filter((t) => t.status === "blocked");
    const activeTasks = tasks.filter(
      (t) => t.status === "in_progress" || t.status === "review"
    );

    const projectById = new Map(projects.map((p) => [p.id, p] as const));
    return { staleAgents, blockedTasks, activeTasks, projectById };
  }, [agents, tasks, projects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading controller...</p>
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
            Controller
          </p>
          <h1 className="text-3xl font-semibold">AI Controller</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Heuristic monitoring until real-time signals and LLM evaluations
            ship.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            refresh {Math.floor(REFRESH_MS / 1000)}s
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            stale &gt; {STALE_MINUTES}m: {derived.staleAgents.length}
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            blocked tasks: {derived.blockedTasks.length}
          </span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Agents
          </p>
          <p className="mt-2 text-2xl font-semibold">{agents.length}</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {agents.filter((a) => a.status === "active").length} active ·{" "}
            {agents.filter((a) => a.status === "idle").length} idle
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Tasks
          </p>
          <p className="mt-2 text-2xl font-semibold">{tasks.length}</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {derived.activeTasks.length} active · {derived.blockedTasks.length}{" "}
            blocked · {tasks.filter((t) => t.status === "completed").length} done
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Projects
          </p>
          <p className="mt-2 text-2xl font-semibold">{projects.length}</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {projects.filter((p) => p.status === "active").length} active ·{" "}
            {projects.filter((p) => p.status === "blocked").length} blocked
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Signal
              </p>
              <h2 className="text-lg font-semibold">Stale Agents</h2>
            </div>
            <span className="text-xs text-[var(--muted)]">
              cutoff: {STALE_MINUTES}m
            </span>
          </div>

          {derived.staleAgents.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              All agents are heartbeating recently.
            </p>
          ) : (
            <div className="space-y-3">
              {derived.staleAgents.slice(0, 12).map((agent) => {
                const mins = minutesAgo(agent.lastHeartbeat);
                const heartbeatLabel =
                  mins === null ? "no heartbeat" : `${mins}m ago`;
                return (
                  <div
                    key={agent.id}
                    className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Agent
                        </p>
                        <p className="text-lg font-semibold">{agent.name}</p>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          Last heartbeat: {formatTime(agent.lastHeartbeat)} (
                          {heartbeatLabel})
                        </p>
                      </div>
                      <StatusPill status={agent.status} />
                    </div>
                    {(agent.currentProjectId || agent.currentTaskId) && (
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        Current:{" "}
                        {agent.currentProjectId
                          ? `project ${agent.currentProjectId}`
                          : "no project"}
                        {" · "}
                        {agent.currentTaskId
                          ? `task ${agent.currentTaskId}`
                          : "no task"}
                      </p>
                    )}
                  </div>
                );
              })}
              {derived.staleAgents.length > 12 && (
                <p className="text-xs text-[var(--muted)]">
                  Showing 12 of {derived.staleAgents.length}.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Signal
              </p>
              <h2 className="text-lg font-semibold">Blocked Tasks</h2>
            </div>
            <span className="text-xs text-[var(--muted)]">
              sorted: recently updated
            </span>
          </div>

          {derived.blockedTasks.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No blocked tasks at the moment.
            </p>
          ) : (
            <div className="space-y-3">
              {derived.blockedTasks.slice(0, 12).map((task) => {
                const project = task.projectId
                  ? derived.projectById.get(task.projectId)
                  : null;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "rounded-2xl border bg-[var(--surface-2)] p-4",
                      "border-[var(--card-border)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Task
                        </p>
                        <p className="text-lg font-semibold">{task.title}</p>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          {project ? project.name : "No project"} · priority{" "}
                          {task.priority} · updated {formatTime(task.updatedAt)}
                        </p>
                      </div>
                      <StatusPill status={task.status} />
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Assignee: {task.assigneeType} {task.assigneeId}
                    </p>
                  </div>
                );
              })}
              {derived.blockedTasks.length > 12 && (
                <p className="text-xs text-[var(--muted)]">
                  Showing 12 of {derived.blockedTasks.length}.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

