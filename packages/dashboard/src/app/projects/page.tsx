"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  githubRepo: string;
  githubBranch: string;
  strategyPath: string;
  assignedAgentIds: string[];
  assignedEmployeeIds: string[];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Project[]>("/api/projects");
        setProjects(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const summary = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "active").length;
    const blocked = projects.filter((p) => p.status === "blocked").length;
    return { total, active, blocked };
  }, [projects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading projects...</p>
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
            Projects
          </p>
          <h1 className="text-3xl font-semibold">Active Portfolio</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Track the strategic initiatives, ownership, and the current health
            of each project.
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
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Project
                </p>
                <h3 className="text-lg font-semibold">{project.name}</h3>
              </div>
              <StatusPill status={project.status} />
            </div>

            <p className="text-sm text-[var(--muted)] mt-3 line-clamp-2">
              {project.description || "No description yet."}
            </p>

            <div className="mt-4 space-y-2 text-xs text-[var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Repo</span>
                <span className="text-[var(--foreground)]">
                  {project.githubRepo}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Branch</span>
                <span className="text-[var(--foreground)]">
                  {project.githubBranch}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Strategy</span>
                <span className="text-[var(--foreground)]">
                  {project.strategyPath}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2">
                <p className="text-[var(--muted)]">Agents</p>
                <p className="text-sm font-medium">
                  {project.assignedAgentIds?.length ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2">
                <p className="text-[var(--muted)]">Employees</p>
                <p className="text-sm font-medium">
                  {project.assignedEmployeeIds?.length ?? 0}
                </p>
              </div>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-[var(--muted)]">
            No projects created yet. Add one to begin.
          </div>
        )}
      </section>
    </div>
  );
}
