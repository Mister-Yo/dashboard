"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  currentProjectId: string | null;
  currentTaskId: string | null;
  lastHeartbeat: string | null;
  permissions: string[];
}

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Agent[]>("/api/agents");
        setAgents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agents");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const summary = useMemo(() => {
    const total = agents.length;
    const active = agents.filter((a) => a.status === "active").length;
    const idle = agents.filter((a) => a.status === "idle").length;
    return { total, active, idle };
  }, [agents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading agents...</p>
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
            Agents
          </p>
          <h1 className="text-3xl font-semibold">Agent Fleet</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Monitor autonomous workers, their roles, and their latest heartbeat.
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
            {summary.idle} idle
          </span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Agent
                </p>
                <h3 className="text-lg font-semibold">{agent.name}</h3>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {agent.type}
                </p>
              </div>
              <StatusPill status={agent.status} />
            </div>

            <div className="mt-4 grid gap-2 text-xs text-[var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Heartbeat</span>
                <span className="text-[var(--foreground)]">
                  {formatTime(agent.lastHeartbeat)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Project</span>
                <span className="text-[var(--foreground)]">
                  {agent.currentProjectId ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Task</span>
                <span className="text-[var(--foreground)]">
                  {agent.currentTaskId ?? "—"}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
              <p className="text-[var(--muted)]">Permissions</p>
              <p className="text-sm font-medium">
                {agent.permissions?.length
                  ? agent.permissions.join(", ")
                  : "No permissions set"}
              </p>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-[var(--muted)]">
            No agents registered yet.
          </div>
        )}
      </section>
    </div>
  );
}
