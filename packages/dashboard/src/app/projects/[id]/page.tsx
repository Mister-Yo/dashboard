"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type BlockerSeverity = "low" | "medium" | "high" | "critical";
type TaskStatus = "pending" | "in_progress" | "review" | "completed" | "blocked";

interface Blocker {
  id: string;
  projectId: string;
  description: string;
  severity: BlockerSeverity;
  reportedBy: string;
  reportedAt: string;
  resolvedAt: string | null;
}

interface Achievement {
  id: string;
  projectId: string;
  description: string;
  achievedBy: string;
  achievedAt: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  status: string;
  githubRepo: string;
  githubBranch: string;
  strategyPath: string;
  blockers: Blocker[];
  achievements: Achievement[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: string;
  assigneeType: string;
  assigneeId: string;
  delegatedBy: string;
  updatedAt: string;
}

function formatTime(value: string | null | undefined) {
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

const severityTone: Record<BlockerSeverity, string> = {
  low: "text-slate-200",
  medium: "text-amber-200",
  high: "text-rose-200",
  critical: "text-rose-100",
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [blockerDescription, setBlockerDescription] = useState("");
  const [blockerSeverity, setBlockerSeverity] =
    useState<BlockerSeverity>("medium");
  const [blockerReportedBy, setBlockerReportedBy] = useState("CEO");

  const [achievementDescription, setAchievementDescription] = useState("");
  const [achievementBy, setAchievementBy] = useState("CEO");

  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!projectId) return;
      try {
        setLoading(true);
        const [p, t] = await Promise.all([
          apiFetch<ProjectDetail>(`/api/projects/${projectId}`),
          apiFetch<Task[]>(`/api/tasks?projectId=${projectId}`),
        ]);
        t.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setProject(p);
        setTasks(t);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load project detail"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  const taskCounts = useMemo(() => {
    return tasks.reduce<Record<TaskStatus, number>>(
      (acc, task) => {
        acc[task.status] = (acc[task.status] ?? 0) + 1;
        return acc;
      },
      {
        pending: 0,
        in_progress: 0,
        review: 0,
        blocked: 0,
        completed: 0,
      }
    );
  }, [tasks]);

  const openBlockers = useMemo(() => {
    return (project?.blockers ?? []).filter((b) => !b.resolvedAt);
  }, [project]);

  const resolvedBlockers = useMemo(() => {
    return (project?.blockers ?? []).filter((b) => Boolean(b.resolvedAt));
  }, [project]);

  async function addBlocker() {
    if (!projectId || !project) return;
    if (!blockerDescription.trim()) return;
    setSubmitting("add_blocker");
    setError(null);
    try {
      const created = await apiFetch<Blocker>(`/api/projects/${projectId}/blockers`, {
        method: "POST",
        body: JSON.stringify({
          description: blockerDescription.trim(),
          severity: blockerSeverity,
          reportedBy: blockerReportedBy || "CEO",
        }),
      });
      setProject((prev) =>
        prev ? { ...prev, blockers: [created, ...(prev.blockers ?? [])] } : prev
      );
      setBlockerDescription("");
      setBlockerSeverity("medium");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add blocker");
    } finally {
      setSubmitting(null);
    }
  }

  async function resolveBlocker(blockerId: string) {
    if (!projectId || !project) return;
    setSubmitting(`resolve:${blockerId}`);
    setError(null);
    try {
      const resolved = await apiFetch<Blocker>(
        `/api/projects/${projectId}/blockers/${blockerId}/resolve`,
        { method: "PATCH", body: JSON.stringify({}) }
      );
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blockers: (prev.blockers ?? []).map((b) =>
            b.id === blockerId ? resolved : b
          ),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve blocker");
    } finally {
      setSubmitting(null);
    }
  }

  async function addAchievement() {
    if (!projectId || !project) return;
    if (!achievementDescription.trim()) return;
    setSubmitting("add_achievement");
    setError(null);
    try {
      const created = await apiFetch<Achievement>(
        `/api/projects/${projectId}/achievements`,
        {
          method: "POST",
          body: JSON.stringify({
            description: achievementDescription.trim(),
            achievedBy: achievementBy || "CEO",
          }),
        }
      );
      setProject((prev) =>
        prev
          ? {
              ...prev,
              achievements: [created, ...(prev.achievements ?? [])],
            }
          : prev
      );
      setAchievementDescription("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add achievement"
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    setSubmitting(`task:${taskId}`);
    setError(null);
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update task status"
      );
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading project...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2">Project error</p>
          <p className="text-[var(--muted)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button onClick={() => router.push("/projects")}>Back to Projects</Button>
        <p className="text-[var(--muted)]">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <button
              onClick={() => router.push("/projects")}
              className="hover:text-[var(--foreground)] transition"
            >
              Projects
            </button>
            <span>/</span>
            <span className="text-[var(--foreground)]">{project.name}</span>
          </div>
          <h1 className="text-3xl font-semibold mt-2">{project.name}</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">
            {project.description || "No description yet."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={project.status} />
          <Button onClick={() => router.push("/projects")}>
            Back
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Tasks
          </p>
          <p className="mt-2 text-2xl font-semibold">{tasks.length}</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {taskCounts.in_progress} active · {taskCounts.review} review ·{" "}
            {taskCounts.blocked} blocked
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Blockers
          </p>
          <p className="mt-2 text-2xl font-semibold">{openBlockers.length}</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {resolvedBlockers.length} resolved
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Achievements
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {project.achievements?.length ?? 0}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">Logged wins</p>
        </div>
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Repo
          </p>
          <p className="mt-2 text-sm font-medium break-all">
            {project.githubRepo}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">
            Branch: {project.githubBranch}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Blockers
              </p>
              <h2 className="text-lg font-semibold">Current Issues</h2>
            </div>
          </div>

          <div className="grid gap-3">
            {openBlockers.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No open blockers.</p>
            ) : (
              openBlockers.map((blocker) => (
                <div
                  key={blocker.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={cn(
                          "text-xs uppercase tracking-[0.2em]",
                          severityTone[blocker.severity]
                        )}
                      >
                        {blocker.severity}
                      </p>
                      <p className="text-sm mt-2 whitespace-pre-wrap">
                        {blocker.description}
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-2">
                        Reported by {blocker.reportedBy} ·{" "}
                        {formatTime(blocker.reportedAt)}
                      </p>
                    </div>
                    <Button
                      className="px-3 py-2 text-xs"
                      onClick={() => resolveBlocker(blocker.id)}
                      disabled={submitting === `resolve:${blocker.id}`}
                    >
                      {submitting === `resolve:${blocker.id}` ? "..." : "Resolve"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {resolvedBlockers.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-[var(--muted)]">
                {resolvedBlockers.length} resolved blocker(s)
              </summary>
              <div className="mt-3 grid gap-3">
                {resolvedBlockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {blocker.severity}
                    </p>
                    <p className="text-sm mt-2 whitespace-pre-wrap">
                      {blocker.description}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-2">
                      Resolved · {formatTime(blocker.resolvedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Add blocker
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                className={selectClassName()}
                value={blockerSeverity}
                onChange={(event) =>
                  setBlockerSeverity(event.target.value as BlockerSeverity)
                }
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
              <Input
                placeholder="Reported by"
                value={blockerReportedBy}
                onChange={(event) => setBlockerReportedBy(event.target.value)}
              />
              <div className="md:col-span-2">
                <Textarea
                  rows={3}
                  placeholder="Describe the blocker..."
                  value={blockerDescription}
                  onChange={(event) => setBlockerDescription(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end">
              <Button
                onClick={addBlocker}
                disabled={submitting === "add_blocker" || !blockerDescription.trim()}
              >
                {submitting === "add_blocker" ? "Adding..." : "Add blocker"}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Achievements
              </p>
              <h2 className="text-lg font-semibold">Wins</h2>
            </div>
          </div>

          <div className="grid gap-3">
            {(project.achievements ?? []).length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No achievements logged.
              </p>
            ) : (
              (project.achievements ?? []).map((achievement) => (
                <div
                  key={achievement.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {achievement.description}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-2">
                    {achievement.achievedBy} · {formatTime(achievement.achievedAt)}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Add achievement
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Achieved by"
                value={achievementBy}
                onChange={(event) => setAchievementBy(event.target.value)}
              />
              <div className="md:col-span-2">
                <Textarea
                  rows={3}
                  placeholder="Describe the achievement..."
                  value={achievementDescription}
                  onChange={(event) =>
                    setAchievementDescription(event.target.value)
                  }
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end">
              <Button
                onClick={addAchievement}
                disabled={
                  submitting === "add_achievement" ||
                  !achievementDescription.trim()
                }
              >
                {submitting === "add_achievement"
                  ? "Adding..."
                  : "Add achievement"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Tasks
            </p>
            <h2 className="text-lg font-semibold">Work Items</h2>
          </div>
          <Link
            href={`/tasks?projectId=${projectId}`}
            className="text-sm text-[var(--primary)] hover:underline underline-offset-4"
          >
            Open in Tasks
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
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
                    {task.priority} · Updated {formatTime(task.updatedAt)}
                  </p>
                </div>
                <StatusPill status={task.status} />
              </div>

              {task.description && (
                <p className="text-sm text-[var(--muted)] mt-3 line-clamp-3 whitespace-pre-wrap">
                  {task.description}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <select
                  className={selectClassName()}
                  value={task.status}
                  disabled={submitting === `task:${task.id}`}
                  onChange={(event) =>
                    updateTaskStatus(task.id, event.target.value as TaskStatus)
                  }
                >
                  <option value="pending">pending</option>
                  <option value="in_progress">in_progress</option>
                  <option value="review">review</option>
                  <option value="blocked">blocked</option>
                  <option value="completed">completed</option>
                </select>
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-[var(--muted)]">
              No tasks for this project yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

