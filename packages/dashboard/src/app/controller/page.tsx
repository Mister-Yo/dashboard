"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAgents, useProjects, useTasks } from "@/hooks/use-api";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/ui/fade-in";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatTimeAgo, formatTime } from "@/lib/time-utils";

interface Evaluation {
  id: string;
  subjectType: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, unknown>;
  aiAnalysis: string;
  recommendations: string[];
  createdAt: string;
}

const STALE_MINUTES = 15;

// Removed - now using formatTimeAgo and formatTime from lib/time-utils

export default function ControllerPage() {
  const { data: agents = [], isLoading: loadingAgents, error: agentsError, refetch } = useAgents();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();

  const { data: evaluations = [] } = useQuery<Evaluation[]>({
    queryKey: ["evaluations"],
    queryFn: () => apiFetch("/api/evaluations"),
  });

  const [expandedEval, setExpandedEval] = useState<string | null>(null);

  const qc = useQueryClient();
  const generateReport = useMutation({
    mutationFn: (period: string) =>
      apiFetch("/api/evaluations/generate", {
        method: "POST",
        body: JSON.stringify({ period }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evaluations"] }),
  });

  const sortedTasks = useMemo(
    () => [...tasks].sort((x, y) => new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime()),
    [tasks]
  );

  const derived = useMemo(() => {
    const staleCutoff = Date.now() - STALE_MINUTES * 60 * 1000;
    const staleAgents = agents.filter((a) => {
      if (!a.lastHeartbeat) return true;
      const time = new Date(a.lastHeartbeat).getTime();
      if (Number.isNaN(time)) return true;
      return time < staleCutoff;
    });

    const blockedTasks = sortedTasks.filter((t) => t.status === "blocked");
    const activeTasks = sortedTasks.filter(
      (t) => t.status === "in_progress" || t.status === "review"
    );

    const projectById = new Map(projects.map((p) => [p.id, p] as const));
    return { staleAgents, blockedTasks, activeTasks, projectById };
  }, [agents, sortedTasks, projects]);

  const loading = loadingAgents || loadingTasks || loadingProjects;

  if (loading) {
    return (
      <FadeIn>
        <PageHeader label="Intelligence" title="AI Controller" />
        <SkeletonGrid count={6} />
      </FadeIn>
    );
  }

  if (agentsError) {
    return <ErrorState message="Failed to connect to API" detail={agentsError?.message} onRetry={() => refetch()} />;
  }

  return (
    <FadeIn>
      <div className="space-y-8">
        <PageHeader
          label="Intelligence"
          title="AI Controller"
          description="Real-time monitoring with auto-refresh via React Query."
          stats={[
            { label: "stale agents", value: derived.staleAgents.length, color: "warning" as const },
            { label: "blocked", value: derived.blockedTasks.length, color: "danger" as const },
            { label: "active tasks", value: derived.activeTasks.length, color: "success" as const },
          ]}
        />

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
            <p className="mt-2 text-2xl font-semibold">{sortedTasks.length}</p>
            <p className="text-xs text-[var(--muted)] mt-1">
              {derived.activeTasks.length} active · {derived.blockedTasks.length}{" "}
              blocked · {sortedTasks.filter((t) => t.status === "completed").length} done
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
              <EmptyState icon="✓" title="All agents are heartbeating recently" compact />
            ) : (
              <div className="space-y-3">
                {derived.staleAgents.slice(0, 12).map((agent) => {
                  const heartbeatLabel = formatTimeAgo(agent.lastHeartbeat);
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
              <EmptyState icon="✓" title="No blocked tasks at the moment" compact />
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

        {/* AI Evaluation Reports */}
        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                AI Controller
              </p>
              <h2 className="text-lg font-semibold">Performance Evaluations</h2>
            </div>
            <div className="flex items-center gap-2">
              {(["daily", "weekly", "monthly"] as const).map((period) => (
                <Button
                  key={period}
                  onClick={() => generateReport.mutate(period)}
                  disabled={generateReport.isPending}
                  className="px-3 py-1.5 text-xs"
                >
                  {generateReport.isPending && generateReport.variables === period ? "Generating..." : `Generate ${period}`}
                </Button>
              ))}
            </div>
          </div>

          {generateReport.error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {generateReport.error.message}
            </div>
          )}

          {evaluations.length === 0 ? (
            <EmptyState icon="📊" title="No evaluations yet" description="Generate your first report using the buttons above." />
          ) : (
            <div className="space-y-3">
              {evaluations.slice(0, 10).map((ev) => {
                const isExpanded = expandedEval === ev.id;
                const metrics = ev.metrics as Record<string, number | null>;
                return (
                  <div
                    key={ev.id}
                    className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedEval(isExpanded ? null : ev.id)}
                      className="w-full text-left p-4 hover:bg-[var(--surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.15em] font-medium rounded-md border border-[var(--card-border)] px-2 py-0.5">
                              {ev.period}
                            </span>
                            <span className="text-xs text-[var(--muted)]">
                              {new Date(ev.createdAt).toLocaleDateString("ru-RU", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted)]">
                            {metrics.tasksCompleted != null && (
                              <span>Completed: {metrics.tasksCompleted}</span>
                            )}
                            {metrics.tasksBlocked != null && (
                              <span>Blocked: {metrics.tasksBlocked}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[var(--muted)] text-sm mt-1">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                      {ev.recommendations.length > 0 && !isExpanded && (
                        <p className="text-xs text-[var(--muted)] mt-2 truncate max-w-lg">
                          {ev.recommendations[0]}
                        </p>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-[var(--card-border)] p-4">
                        {ev.recommendations.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
                              Key Signals
                            </p>
                            <ul className="space-y-1">
                              {ev.recommendations.map((r, i) => (
                                <li key={i} className="text-sm text-[var(--muted)] flex items-start gap-2">
                                  <span className="mt-0.5">•</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ev.aiAnalysis && (
                          <div>
                            <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
                              AI Analysis
                            </p>
                            <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)] opacity-90">
                              {ev.aiAnalysis}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </FadeIn>
  );
}
