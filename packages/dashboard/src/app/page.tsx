"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAgents, useEmployees, useProjects, useTasks, useActivityEvents } from "@/hooks/use-api";
import { StatusPill } from "@/components/ui/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonKPI, SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  status: string;
  projectId: string | null;
}

function KPICard({
  label,
  value,
  sub,
  color = "text-[var(--foreground)]",
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 hover:border-[var(--accent)]/30 transition-colors">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mb-1">
        {label}
      </p>
      <p className={cn("text-2xl font-semibold tabular-nums", color)}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--muted)] mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const eventIcons: Record<string, string> = {
  task_created: "+",
  task_completed: "✓",
  task_updated: "~",
  agent_started: "▶",
  agent_stopped: "■",
  blocker_added: "!",
  blocker_resolved: "✓",
  commit: "◆",
  review: "◇",
  default: "•",
};

export default function BoardPage() {
  const { data: projects = [], isLoading: pLoading, error: pErr, refetch: pRefetch } = useProjects();
  const { data: agents = [], isLoading: aLoading } = useAgents();
  const { data: employees = [], isLoading: eLoading } = useEmployees();
  const { data: allTasks = [] } = useTasks();
  const { data: events = [] } = useActivityEvents(15);

  // Per-project task queries
  const taskQueries = useQueries({
    queries: projects.map((project: any) => ({
      queryKey: ["tasks", { projectId: project.id }],
      queryFn: () => apiFetch<Task[]>(`/api/tasks?projectId=${project.id}`),
    })),
  });

  const projectTaskMap = useMemo(() => {
    const map: Record<string, { total: number; completed: number; blocked: number }> = {};
    projects.forEach((p: any, i: number) => {
      const tasks = (taskQueries[i]?.data ?? []) as Task[];
      map[p.id] = {
        total: tasks.length,
        completed: tasks.filter((t) => t.status === "completed").length,
        blocked: tasks.filter((t) => t.status === "blocked").length,
      };
    });
    return map;
  }, [projects, taskQueries]);

  const isLoading = pLoading || aLoading || eLoading;

  if (pErr) {
    return (
      <ErrorState
        message="Failed to connect to API"
        detail={pErr instanceof Error ? pErr.message : "Unknown error"}
        onRetry={() => pRefetch()}
      />
    );
  }

  // KPIs
  const activeProjects = projects.filter((p: any) => p.status === "active").length;
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t: any) => t.status === "completed").length;
  const blockedTasks = allTasks.filter((t: any) => t.status === "blocked").length;
  const activeAgents = agents.filter((a: any) => a.status === "working" || a.status === "active").length;

  return (
    <FadeIn>
      <PageHeader
        label="Command Center"
        title="Board"
        description="Live overview of projects, agents, and tasks"
      />

      {/* KPI Cards */}
      {isLoading ? (
        <SkeletonKPI count={5} />
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-8">
          <KPICard label="Projects" value={projects.length} sub={`${activeProjects} active`} href="/projects" />
          <KPICard label="Tasks" value={totalTasks} sub={`${completedTasks} done`} href="/tasks" />
          <KPICard
            label="Agents"
            value={`${activeAgents}/${agents.length}`}
            sub="online"
            color="text-[var(--primary)]"
            href="/agents"
          />
          <KPICard
            label="Blocked"
            value={blockedTasks}
            color={blockedTasks > 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}
            sub="tasks need attention"
            href="/tasks"
          />
          <KPICard label="Team" value={employees.length} sub="employees" href="/employees" />
        </div>
      )}

      {/* Main: Projects + Activity */}
      <div className="grid gap-6 xl:grid-cols-[1fr,340px]">
        {/* Projects compact list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
              Projects
            </h2>
            <Link href="/projects" className="text-xs text-[var(--accent)] hover:underline">
              View all
            </Link>
          </div>

          {isLoading ? (
            <SkeletonList rows={4} />
          ) : projects.length === 0 ? (
            <EmptyState icon="📁" title="No projects" description="Create your first project to get started" />
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 8).map((project: any) => {
                const task = projectTaskMap[project.id] ?? { total: 0, completed: 0, blocked: 0 };
                const pct = task.total > 0 ? Math.round((task.completed / task.total) * 100) : 0;
                const projectAgents = agents.filter((a: any) => a.currentProjectId === project.id);

                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-3.5 hover:border-[var(--accent)]/30 transition-colors group"
                  >
                    {/* Progress ring */}
                    <div className="relative h-10 w-10 shrink-0">
                      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                        <circle
                          cx="18" cy="18" r="15.5"
                          fill="none"
                          stroke="var(--card-border)"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18" cy="18" r="15.5"
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth="3"
                          strokeDasharray={`${pct} ${100 - pct}`}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">
                        {pct}%
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                          {project.name}
                        </p>
                        <StatusPill status={project.status} />
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        {task.completed}/{task.total} tasks
                        {task.blocked > 0 && (
                          <span className="text-[var(--danger)]"> · {task.blocked} blocked</span>
                        )}
                        {projectAgents.length > 0 && (
                          <span> · {projectAgents.map((a: any) => a.name).join(", ")}</span>
                        )}
                      </p>
                    </div>

                    {/* Agent avatars */}
                    {projectAgents.length > 0 && (
                      <div className="flex -space-x-2 shrink-0">
                        {projectAgents.slice(0, 3).map((a: any) => (
                          <div
                            key={a.id}
                            className="h-7 w-7 rounded-full bg-[var(--surface-2)] border-2 border-[var(--card)] flex items-center justify-center text-[9px] font-semibold text-[var(--muted)]"
                            title={a.name}
                          >
                            {a.name.slice(0, 2).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Activity Feed */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
              Recent Activity
            </h2>
            <Link href="/activity" className="text-xs text-[var(--accent)] hover:underline">
              View all
            </Link>
          </div>

          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] divide-y divide-[var(--card-border)]">
            {events.length === 0 ? (
              <EmptyState icon="📡" title="No activity yet" compact />
            ) : (
              events.slice(0, 10).map((event: any) => (
                <div key={event.id} className="px-4 py-3 flex gap-3">
                  <span className="text-xs shrink-0 mt-0.5 w-4 text-center text-[var(--muted)]">
                    {eventIcons[event.eventType] ?? eventIcons.default}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--foreground)] line-clamp-2">
                      <span className="font-medium">{event.actorName}</span>{" "}
                      {event.title}
                    </p>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5">
                      {timeAgo(event.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </FadeIn>
  );
}
