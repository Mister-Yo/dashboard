"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useStrategyChanges } from "@/hooks/use-api";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

interface GitHubActivity {
  commits: { sha: string; message: string; author: string; date: string; url: string }[];
  issues: { number: number; title: string; state: string; createdAt: string; url: string }[];
  pullRequests: { number: number; title: string; state: string; createdAt: string; url: string; draft: boolean }[];
}

function useGitHubActivity(projectId: string | null) {
  return useQuery<GitHubActivity>({
    queryKey: ["github-activity", projectId],
    queryFn: () => apiFetch(`/api/github/projects/${projectId}/activity`),
    enabled: !!projectId,
    staleTime: 120_000,
    retry: false,
  });
}

function timeAgo(date: string) {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

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
  const [showStrategyHistory, setShowStrategyHistory] = useState(false);
  const { data: strategyChanges = [] } = useStrategyChanges(projectId);
  const { data: github, isLoading: ghLoading, error: ghError } = useGitHubActivity(projectId || null);

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
      const updated = await apiFetch<TaskLite>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setMutating(null);
    }
  }

  if (loading) {
    return (
      <FadeIn>
        <PageHeader label="Project" title="Loading..." />
        <SkeletonGrid count={4} />
      </FadeIn>
    );
  }

  if (!projectId) {
    return <ErrorState message="Invalid project ID" detail="Missing route parameter." />;
  }

  if (error) {
    return <ErrorState message="Failed to connect to API" detail={error} />;
  }

  if (!project) {
    return (
      <EmptyState icon="📁" title="Project not found" description="This project may have been deleted." />
    );
  }

  return (
    <FadeIn className="space-y-8">
      <PageHeader
        label="Project"
        title={project.name}
        description={project.description || "No description yet."}
        stats={[
          { label: project.status, value: tasks.length, color: project.status === "active" ? "success" as const : "muted" as const },
        ]}
        actions={
          <Link
            href={`/tasks?projectId=${project.id}`}
            className="inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-strong)] transition"
          >
            Open Tasks
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
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
      </div>

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

      {/* GitHub Activity */}
      {project.githubRepo && (
        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">GitHub</p>
              <h2 className="text-lg font-semibold">Repository Activity</h2>
            </div>
          </div>

          {ghLoading && <p className="text-sm text-[var(--muted)]">Loading GitHub data...</p>}
          {ghError && <p className="text-sm text-[var(--muted)]">GitHub integration not available.</p>}

          {github && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Recent Commits</h3>
                {github.commits.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">No recent commits.</p>
                ) : (
                  <div className="space-y-2">
                    {github.commits.map((c) => (
                      <a key={c.sha} href={c.url} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-xl hover:bg-white/5 transition">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">{c.sha}</code>
                          <span className="text-[10px] text-[var(--muted)]">{timeAgo(c.date)}</span>
                        </div>
                        <p className="text-xs mt-1 truncate">{c.message}</p>
                        <p className="text-[10px] text-[var(--muted)] mt-0.5">{c.author}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Open Issues</h3>
                {github.issues.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">No open issues.</p>
                ) : (
                  <div className="space-y-2">
                    {github.issues.map((i) => (
                      <a key={i.number} href={i.url} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-xl hover:bg-white/5 transition">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">#{i.number}</span>
                          <span className="text-[10px] text-[var(--muted)]">{timeAgo(i.createdAt)}</span>
                        </div>
                        <p className="text-xs mt-1">{i.title}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Open PRs</h3>
                {github.pullRequests.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">No open PRs.</p>
                ) : (
                  <div className="space-y-2">
                    {github.pullRequests.map((pr) => (
                      <a key={pr.number} href={pr.url} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-xl hover:bg-white/5 transition">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">#{pr.number}</span>
                          {pr.draft && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">draft</span>}
                          <span className="text-[10px] text-[var(--muted)]">{timeAgo(pr.createdAt)}</span>
                        </div>
                        <p className="text-xs mt-1">{pr.title}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Strategy History */}
      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Strategy
            </p>
            <h2 className="text-lg font-semibold">Change History</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">
              {strategyChanges.length} changes
            </span>
            {strategyChanges.length > 0 && (
              <button
                onClick={() => setShowStrategyHistory(!showStrategyHistory)}
                className="text-xs text-[var(--foreground)] hover:underline underline-offset-4"
              >
                {showStrategyHistory ? "Hide" : "Show"}
              </button>
            )}
          </div>
        </div>

        {strategyChanges.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No strategy changes recorded yet.</p>
        ) : !showStrategyHistory ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Latest · {formatTime(strategyChanges[0].timestamp)} · by {strategyChanges[0].authorName}
            </p>
            <p className="mt-2 text-sm text-[var(--foreground)]">
              {strategyChanges[0].summary}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {strategyChanges.slice(0, 10).map((sc) => {
              let diffParsed: Record<string, { old: unknown; new: unknown }> | null = null;
              try { diffParsed = JSON.parse(sc.diff); } catch {}
              return (
                <div
                  key={sc.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {formatTime(sc.timestamp)} · by {sc.authorName}
                        {sc.commitSha && (
                          <span className="ml-2 font-mono text-[var(--foreground)]">
                            {sc.commitSha.slice(0, 7)}
                          </span>
                        )}
                      </p>
                      <p className="mt-2 text-sm text-[var(--foreground)]">{sc.summary}</p>
                    </div>
                    <span className="text-xs rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[var(--muted)]">
                      {sc.authorType}
                    </span>
                  </div>
                  {diffParsed && (
                    <div className="mt-3 space-y-1">
                      {Object.entries(diffParsed).map(([key, val]) => (
                        <div key={key} className="text-xs text-[var(--muted)] flex gap-2">
                          <span className="font-medium text-[var(--foreground)]">{key}:</span>
                          <span className="text-red-400 line-through">{String(val.old).slice(0, 60)}</span>
                          <span>→</span>
                          <span className="text-emerald-400">{String(val.new).slice(0, 60)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {strategyChanges.length > 10 && (
              <p className="text-xs text-[var(--muted)]">
                Showing 10 of {strategyChanges.length}.
              </p>
            )}
          </div>
        )}
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
    </FadeIn>
  );
}
