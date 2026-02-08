"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";

interface Agent {
  id: string;
  name: string;
  status: string;
  currentProjectId: string | null;
  currentTaskId: string | null;
  lastHeartbeat: string | null;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
  assignedProjectIds: string[];
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  updatedAt: string;
  completedAt: string | null;
}

function minutesAgo(iso: string | null) {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  return Math.max(0, Math.floor(diffMs / 60000));
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>
    </div>
  );
}

export default function ControllerPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        setError(null);
        const [a, e, p, t] = await Promise.all([
          apiFetch<Agent[]>("/api/agents"),
          apiFetch<Employee[]>("/api/employees"),
          apiFetch<Project[]>("/api/projects"),
          apiFetch<Task[]>("/api/tasks"),
        ]);
        setAgents(a);
        setEmployees(e);
        setProjects(p);
        setTasks(t);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load controller data"
        );
      } finally {
        setLoading(false);
        inFlight = false;
      }
    }
    load();

    timer = setInterval(load, 20000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const agentSummary = useMemo(() => {
    const total = agents.length;
    const byStatus = agents.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {});
    const stale = agents
      .map((a) => ({ agent: a, mins: minutesAgo(a.lastHeartbeat) }))
      .filter((x) => x.mins === null || x.mins >= 15)
      .sort((x, y) => (y.mins ?? 10_000) - (x.mins ?? 10_000));
    return { total, byStatus, stale };
  }, [agents]);

  const taskSummary = useMemo(() => {
    const total = tasks.length;
    const byStatus = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    const now = Date.now();
    const completed7d = tasks.filter((t) => {
      if (!t.completedAt) return false;
      const ts = new Date(t.completedAt).getTime();
      if (Number.isNaN(ts)) return false;
      return now - ts <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    const updated24h = tasks.filter((t) => {
      const ts = new Date(t.updatedAt).getTime();
      if (Number.isNaN(ts)) return false;
      return now - ts <= 24 * 60 * 60 * 1000;
    }).length;

    const blocked = tasks.filter((t) => t.status === "blocked");
    blocked.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return { total, byStatus, completed7d, updated24h, blockedTop: blocked.slice(0, 5) };
  }, [tasks]);

  const projectSummary = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "active").length;
    const blocked = projects.filter((p) => p.status === "blocked").length;
    return { total, active, blocked };
  }, [projects]);

  const employeeSummary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const inactive = employees.filter((e) => e.status === "inactive").length;
    return { total, active, inactive };
  }, [employees]);

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
          <p className="text-red-400 mb-2">Controller error</p>
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
            Heuristic monitoring until the LLM evaluator is wired in. Use this
            to spot stale agents and blocked execution.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Agents"
          value={`${agentSummary.total}`}
          hint={`${agentSummary.byStatus.active ?? 0} active · ${agentSummary.byStatus.idle ?? 0} idle`}
        />
        <Stat
          label="Tasks"
          value={`${taskSummary.total}`}
          hint={`${taskSummary.byStatus.in_progress ?? 0} in progress · ${taskSummary.byStatus.blocked ?? 0} blocked`}
        />
        <Stat
          label="Projects"
          value={`${projectSummary.total}`}
          hint={`${projectSummary.blocked} blocked`}
        />
        <Stat
          label="People"
          value={`${employeeSummary.total}`}
          hint={`${employeeSummary.active} active · ${employeeSummary.inactive} inactive`}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Stale Agents</h2>
          <p className="text-sm text-[var(--muted)] mt-2">
            Agents with no heartbeat or heartbeat older than 15 minutes.
          </p>
          <div className="mt-4 grid gap-3">
            {agentSummary.stale.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No stale agents.</p>
            ) : (
              agentSummary.stale.map(({ agent, mins }) => (
                <div
                  key={agent.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-medium">{agent.name}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {mins === null ? "No heartbeat yet" : `${mins} min ago`}
                    </p>
                  </div>
                  <StatusPill status={agent.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Blocked Tasks</h2>
          <p className="text-sm text-[var(--muted)] mt-2">
            Most recently updated blocked tasks.
          </p>
          <div className="mt-4 grid gap-3">
            {taskSummary.blockedTop.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No blocked tasks.</p>
            ) : (
              taskSummary.blockedTop.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Priority: {task.priority} · Updated{" "}
                      {minutesAgo(task.updatedAt) ?? "?"} min ago
                    </p>
                  </div>
                  <StatusPill status={task.status} />
                </div>
              ))
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Activity
            </p>
            <p className="text-sm mt-2">
              {taskSummary.updated24h} task(s) updated in the last 24h ·{" "}
              {taskSummary.completed7d} completed in 7d
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
