"use client";

import { Bot, Briefcase, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  blockers: Array<{ id: string; description: string; severity: string }>;
  achievements: Array<{ id: string; description: string }>;
  taskSummary: {
    pending: number;
    in_progress: number;
    review: number;
    blocked: number;
    completed: number;
  };
}

interface Agent {
  id: string;
  name: string;
  status: string;
  currentProjectId: string | null;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
  assignedProjectIds: string[];
}

interface BoardViewProps {
  projects: Project[];
  agents: Agent[];
  employees: Employee[];
}

const statusTone: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  active: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-200" },
  working: { label: "Working", dot: "bg-cyan-400", text: "text-cyan-200" },
  idle: { label: "Idle", dot: "bg-amber-300", text: "text-amber-200" },
  blocked: { label: "Blocked", dot: "bg-rose-400", text: "text-rose-200" },
  paused: { label: "Paused", dot: "bg-amber-300", text: "text-amber-200" },
  completed: { label: "Done", dot: "bg-emerald-400", text: "text-emerald-200" },
  error: { label: "Error", dot: "bg-rose-400", text: "text-rose-200" },
  inactive: { label: "Inactive", dot: "bg-slate-500", text: "text-slate-300" },
};

function StatusPill({ status }: { status: string }) {
  const tone = statusTone[status] ?? {
    label: status || "Unknown",
    dot: "bg-slate-500",
    text: "text-slate-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-3 py-1 text-xs",
        tone.text
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
      {tone.label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--accent)]" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>
    </div>
  );
}

export function BoardView({ projects, agents, employees }: BoardViewProps) {
  const blockedProjects = projects.filter((p) => p.status === "blocked").length;
  const activeAgents = agents.filter((a) => a.status !== "inactive").length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Situation Room
          </p>
          <h1 className="text-3xl font-semibold">Command Board</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Live snapshot of projects, agents, and people. Watch the pulse, spot
            blockers, keep momentum.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {projects.length} projects
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {agents.length} agents
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {employees.length} employees
          </span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Briefcase}
          label="Projects"
          value={`${projects.length}`}
          hint={`${blockedProjects} blocked`}
        />
        <StatCard
          icon={Bot}
          label="Agents online"
          value={`${activeAgents}`}
          hint="Monitoring live workloads"
        />
        <StatCard
          icon={Users}
          label="Employees"
          value={`${employees.length}`}
          hint="Team availability"
        />
        <StatCard
          icon={ShieldAlert}
          label="Risks"
          value={`${blockedProjects}`}
          hint="Requires attention"
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Project Pulse</h2>
          <span className="text-xs text-[var(--muted)]">
            Updated just now
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const projectAgents = agents.filter(
              (a) => a.currentProjectId === project.id
            );
            const projectEmployees = employees.filter((e) =>
              e.assignedProjectIds?.includes(project.id)
            );
            const blockersPreview = project.blockers?.slice(0, 2) ?? [];
            const achievementsPreview = project.achievements?.slice(0, 2) ?? [];

            return (
              <div
                key={project.id}
                className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Project
                    </p>
                    <h3 className="text-lg font-semibold">
                      <Link
                        href={`/projects/${project.id}`}
                        className="hover:underline underline-offset-4"
                      >
                        {project.name}
                      </Link>
                    </h3>
                  </div>
                  <StatusPill status={project.status} />
                </div>

                <p className="text-sm text-[var(--muted)] mt-3 line-clamp-2">
                  {project.description || "No description yet."}
                </p>

                <div className="mt-4 grid gap-3 text-sm">
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-xs text-[var(--muted)]">Agents</p>
                    <p className="font-medium">
                      {projectAgents.length > 0
                        ? projectAgents.map((a) => a.name).join(", ")
                        : "No active agents"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-xs text-[var(--muted)]">Employees</p>
                    <p className="font-medium">
                      {projectEmployees.length > 0
                        ? projectEmployees.map((e) => e.name).join(", ")
                        : "No assigned employees"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-xs text-[var(--muted)]">Status report</p>
                    <p className="font-medium">
                      {project.taskSummary?.in_progress ?? 0} active ·{" "}
                      {project.taskSummary?.review ?? 0} review ·{" "}
                      {project.taskSummary?.blocked ?? 0} blocked ·{" "}
                      {project.taskSummary?.completed ?? 0} done
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-[var(--muted)]">
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="uppercase tracking-[0.2em] text-[var(--muted)]">
                      Blockers
                    </p>
                    {blockersPreview.length === 0 ? (
                      <p className="text-sm text-[var(--foreground)] mt-2">
                        None reported
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                        {blockersPreview.map((blocker) => (
                          <li key={blocker.id}>• {blocker.description}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="uppercase tracking-[0.2em] text-[var(--muted)]">
                      Achievements
                    </p>
                    {achievementsPreview.length === 0 ? (
                      <p className="text-sm text-[var(--foreground)] mt-2">
                        None logged
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                        {achievementsPreview.map((achievement) => (
                          <li key={achievement.id}>• {achievement.description}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {projects.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-[var(--muted)]">
              No projects yet. Add one to start tracking progress.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4">
          <h3 className="font-semibold mb-3">Agents</h3>
          {agents.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No agents registered</p>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between py-3 border-b border-[var(--card-border)] last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {agent.currentProjectId ? "On project" : "Idle"}
                  </p>
                </div>
                <StatusPill status={agent.status} />
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4">
          <h3 className="font-semibold mb-3">Employees</h3>
          {employees.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No employees registered
            </p>
          ) : (
            employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between py-3 border-b border-[var(--card-border)] last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{employee.name}</p>
                  <p className="text-xs text-[var(--muted)]">{employee.role}</p>
                </div>
                <StatusPill status={employee.status} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
