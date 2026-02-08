"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TaskStatus = "pending" | "in_progress" | "review" | "completed" | "blocked";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type BlockerSeverity = "low" | "medium" | "high" | "critical";

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

interface TaskLite {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeType: string;
  assigneeId: string;
  updatedAt: string;
}

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "review",
  "blocked",
  "completed",
];

const SEVERITY_OPTIONS: BlockerSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

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

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submittingBlocker, setSubmittingBlocker] = useState(false);
  const [blockerDescription, setBlockerDescription] = useState("");
  const [blockerSeverity, setBlockerSeverity] = useState<BlockerSeverity>("medium");
  const [blockerReportedBy, setBlockerReportedBy] = useState("CEO");

  const [submittingAchievement, setSubmittingAchievement] = useState(false);
  const [achievementDescription, setAchievementDescription] = useState("");
  const [achievementBy, setAchievementBy] = useState("CEO");

  const [mutating, setMutating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!projectId) return;
      try {
        const [p, t] = await Promise.all([
          apiFetch<ProjectDetail>(`/api/projects/${projectId}`),
          apiFetch<TaskLite[]>(`/api/tasks?projectId=${projectId}`),
        ]);
        t.sort(
          (x, y) =>
            new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime()
        );
        setProject(p);
        setTasks(t);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [projectId]);

  const derived = useMemo(() => {
    const blockers = project?.blockers ?? [];
    const achievements = project?.achievements ?? [];
    const unresolved = blockers
      .filter((b) => !b.resolvedAt)
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
    const resolved = blockers
      .filter((b) => Boolean(b.resolvedAt))
      .sort((a, b) => new Date((b.resolvedAt ?? b.reportedAt)).getTime() - new Date((a.resolvedAt ?? a.reportedAt)).getTime());
    const achievementsSorted = achievements
      .slice()
      .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
    return { unresolved, resolved, achievementsSorted };
  }, [project]);

  async function addBlocker() {
    if (!projectId || !blockerDescription.trim()) return;
    setSubmittingBlocker(true);
    try {
      const created = await apiFetch<Blocker>(`/api/projects/${projectId}/blockers`, {
        method: "POST",
        body: JSON.stringify({
          description: blockerDescription.trim(),
          severity: blockerSeverity,
          reportedBy: blockerReportedBy.trim() || "CEO",
        }),
      });
      setProject((prev) =>
        prev ? { ...prev, blockers: [created, ...(prev.blockers ?? [])] } : prev
      );
      void logActivity({
        event_type: "blocker",
        title: `Blocker added: ${project?.name ?? projectId}`,
        description: created.description,
        project_id: projectId,
        metadata: {
          blockerId: created.id,
          severity: created.severity,
          reportedBy: created.reportedBy,
        },
      });
      setBlockerDescription("");
      setBlockerSeverity("medium");
      setBlockerReportedBy("CEO");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add blocker");
    } finally {
      setSubmittingBlocker(false);
    }
  }

  async function resolveBlocker(blockerId: string) {
    if (!projectId) return;
    setMutating(`resolve:${blockerId}`);
    try {
      const previous = project?.blockers?.find((b) => b.id === blockerId) ?? null;
      const resolved = await apiFetch<Blocker>(
        `/api/projects/${projectId}/blockers/${blockerId}/resolve`,
        { method: "PATCH", body: JSON.stringify({}) }
      );
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blockers: (prev.blockers ?? []).map((b) => (b.id === blockerId ? resolved : b)),
        };
      });
      void logActivity({
        event_type: "status_change",
        title: `Blocker resolved: ${project?.name ?? projectId}`,
        description: previous?.description ?? "",
        project_id: projectId,
        metadata: { blockerId: blockerId, severity: previous?.severity ?? "medium" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve blocker");
    } finally {
      setMutating(null);
    }
  }

  async function addAchievement() {
    if (!projectId || !achievementDescription.trim()) return;
    setSubmittingAchievement(true);
    try {
      const created = await apiFetch<Achievement>(
        `/api/projects/${projectId}/achievements`,
        {
          method: "POST",
          body: JSON.stringify({
            description: achievementDescription.trim(),
            achievedBy: achievementBy.trim() || "CEO",
          }),
        }
      );
      setProject((prev) =>
        prev
          ? { ...prev, achievements: [created, ...(prev.achievements ?? [])] }
          : prev
      );
      void logActivity({
        event_type: "note",
        title: `Achievement: ${project?.name ?? projectId}`,
        description: created.description,
        project_id: projectId,
        metadata: { achievementId: created.id, achievedBy: created.achievedBy },
      });
      setAchievementDescription("");
      setAchievementBy("CEO");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add achievement");
    } finally {
      setSubmittingAchievement(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    setMutating(`task:${taskId}`);
    try {
      const previous = tasks.find((t) => t.id === taskId);
      const updated = await apiFetch<TaskLite>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      const eventType =
        status === "in_progress"
          ? "start_task"
          : status === "completed"
            ? "finish_task"
            : status === "blocked"
              ? "blocker"
              : "status_change";
      void logActivity({
        event_type: eventType,
        title: `Task status: ${updated.title}`,
        description: previous
          ? `${previous.status} -> ${updated.status}`
          : `-> ${updated.status}`,
        project_id: projectId,
        task_id: updated.id,
        metadata: { status: updated.status, priority: updated.priority },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setMutating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading project...</p>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2">Invalid project id</p>
          <p className="text-[var(--muted)] text-sm">Missing route parameter.</p>
        </div>
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

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Project
          </p>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">
            {project.description || "No description yet."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
            <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
              repo{" "}
              <a
                href={`https://github.com/${project.githubRepo}`}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--foreground)] hover:underline"
              >
                {project.githubRepo}
              </a>
            </span>
            <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
              branch <span className="text-[var(--foreground)]">{project.githubBranch}</span>
            </span>
            <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
              strategy <span className="text-[var(--foreground)]">{project.strategyPath}</span>
            </span>
            <Link
              href={`/tasks?projectId=${project.id}`}
              className="rounded-full border border-[var(--card-border)] px-3 py-1 text-[var(--foreground)] hover:border-[var(--accent)]"
            >
              open tasks
            </Link>
          </div>
        </div>
        <StatusPill status={project.status} />
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Blockers
              </p>
              <h2 className="text-lg font-semibold">Current Blockers</h2>
            </div>
            <span className="text-xs text-[var(--muted)]">
              {derived.unresolved.length} open
            </span>
          </div>

          {derived.unresolved.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No blockers reported.</p>
          ) : (
            <div className="space-y-3">
              {derived.unresolved.map((blocker) => (
                <div
                  key={blocker.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {blocker.severity} · reported {formatTime(blocker.reportedAt)}
                      </p>
                      <p className="mt-2 text-sm text-[var(--foreground)] whitespace-pre-wrap">
                        {blocker.description}
                      </p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        by {blocker.reportedBy}
                      </p>
                    </div>
                    <Button
                      className="px-3 py-2 text-xs"
                      onClick={() => resolveBlocker(blocker.id)}
                      disabled={mutating === `resolve:${blocker.id}`}
                    >
                      {mutating === `resolve:${blocker.id}` ? "..." : "Resolve"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Add blocker
            </p>
            <div className="mt-3 space-y-2">
              <Textarea
                rows={3}
                placeholder="Describe the blocker..."
                value={blockerDescription}
                onChange={(event) => setBlockerDescription(event.target.value)}
              />
              <div className="grid gap-2 md:grid-cols-2">
                <select
                  className={selectClassName()}
                  value={blockerSeverity}
                  onChange={(event) =>
                    setBlockerSeverity(event.target.value as BlockerSeverity)
                  }
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      severity: {s}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Reported by (e.g. CEO)"
                  value={blockerReportedBy}
                  onChange={(event) => setBlockerReportedBy(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-end">
                <Button
                  onClick={addBlocker}
                  disabled={!blockerDescription.trim() || submittingBlocker}
                >
                  {submittingBlocker ? "Adding..." : "Add blocker"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Achievements
              </p>
              <h2 className="text-lg font-semibold">Recent Wins</h2>
            </div>
            <span className="text-xs text-[var(--muted)]">
              {derived.achievementsSorted.length}
            </span>
          </div>

          {derived.achievementsSorted.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No achievements yet.</p>
          ) : (
            <div className="space-y-3">
              {derived.achievementsSorted.slice(0, 10).map((achievement) => (
                <div
                  key={achievement.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {formatTime(achievement.achievedAt)} · by {achievement.achievedBy}
                  </p>
                  <p className="mt-2 text-sm text-[var(--foreground)] whitespace-pre-wrap">
                    {achievement.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Add achievement
            </p>
            <div className="mt-3 space-y-2">
              <Textarea
                rows={3}
                placeholder="What was achieved?"
                value={achievementDescription}
                onChange={(event) =>
                  setAchievementDescription(event.target.value)
                }
              />
              <Input
                placeholder="Achieved by (e.g. CEO)"
                value={achievementBy}
                onChange={(event) => setAchievementBy(event.target.value)}
              />
              <div className="flex items-center justify-end">
                <Button
                  onClick={addAchievement}
                  disabled={!achievementDescription.trim() || submittingAchievement}
                >
                  {submittingAchievement ? "Adding..." : "Add achievement"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Tasks
            </p>
            <h2 className="text-lg font-semibold">Project Tasks</h2>
          </div>
          <Link
            href={`/tasks?projectId=${project.id}`}
            className="text-sm text-[var(--foreground)] hover:underline underline-offset-4"
          >
            open in Tasks
          </Link>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No tasks yet for this project.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tasks.slice(0, 24).map((task) => (
              <div
                key={task.id}
                className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {task.priority} · updated {formatTime(task.updatedAt)}
                    </p>
                    <p className="mt-2 text-base font-semibold">{task.title}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      assignee: {task.assigneeType} {task.assigneeId}
                    </p>
                  </div>
                  <StatusPill status={task.status} />
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <select
                    className={selectClassName()}
                    value={task.status}
                    onChange={(event) =>
                      updateTaskStatus(task.id, event.target.value as TaskStatus)
                    }
                    disabled={mutating === `task:${task.id}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {mutating === `task:${task.id}` && (
                    <span className="text-xs text-[var(--muted)]">
                      Updating...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tasks.length > 24 && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Showing 24 of {tasks.length}. Use Tasks page for full list.
          </p>
        )}
      </section>
    </div>
  );
}
