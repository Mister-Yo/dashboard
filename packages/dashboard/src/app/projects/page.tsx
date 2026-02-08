"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

interface AgentLite {
  id: string;
  name: string;
  status: string;
  currentProjectId: string | null;
}

interface EmployeeLite {
  id: string;
  name: string;
  role: string;
  status: string;
  assignedProjectIds: string[];
}

function selectClassName() {
  return cn(
    "w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3 text-sm",
    "text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");

  const [agentToAssign, setAgentToAssign] = useState<Record<string, string>>(
    {}
  );
  const [employeeToAssign, setEmployeeToAssign] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    async function load() {
      try {
        const [p, a, e] = await Promise.all([
          apiFetch<Project[]>("/api/projects"),
          apiFetch<AgentLite[]>("/api/agents"),
          apiFetch<EmployeeLite[]>("/api/employees"),
        ]);
        setProjects(p);
        setAgents(a);
        setEmployees(e);
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

  async function handleCreate() {
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await apiFetch<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          githubRepo: repo,
          githubBranch: branch,
        }),
      });
      setProjects((prev) => [created, ...prev]);
      void logActivity({
        event_type: "note",
        title: `Project created: ${created.name}`,
        description: created.description,
        project_id: created.id,
        metadata: { githubRepo: created.githubRepo, githubBranch: created.githubBranch },
      });
      setName("");
      setDescription("");
      setRepo("");
      setBranch("main");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function assignAgent(projectId: string) {
    const agentId = agentToAssign[projectId];
    if (!agentId) return;
    setMutating(`agent:${agentId}`);
    setMembershipError(null);
    try {
      const updated = await apiFetch<AgentLite>(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({ currentProjectId: projectId }),
      });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? updated : a)));
      const projectName = projects.find((p) => p.id === projectId)?.name ?? projectId;
      void logActivity({
        event_type: "status_change",
        title: `Agent assigned: ${updated.name}`,
        description: `-> project ${projectName}`,
        project_id: projectId,
        metadata: { agentId: updated.id, agentName: updated.name },
      });
      setAgentToAssign((prev) => ({ ...prev, [projectId]: "" }));
    } catch (err) {
      setMembershipError(
        err instanceof Error ? err.message : "Failed to assign agent"
      );
    } finally {
      setMutating(null);
    }
  }

  async function unassignAgent(agentId: string) {
    setMutating(`agent:${agentId}`);
    setMembershipError(null);
    try {
      const previous = agents.find((a) => a.id === agentId);
      const updated = await apiFetch<AgentLite>(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({ currentProjectId: null }),
      });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? updated : a)));
      if (previous?.currentProjectId) {
        const projectName =
          projects.find((p) => p.id === previous.currentProjectId)?.name ??
          previous.currentProjectId;
        void logActivity({
          event_type: "status_change",
          title: `Agent unassigned: ${updated.name}`,
          description: `<- project ${projectName}`,
          project_id: previous.currentProjectId,
          metadata: { agentId: updated.id, agentName: updated.name },
        });
      }
    } catch (err) {
      setMembershipError(
        err instanceof Error ? err.message : "Failed to unassign agent"
      );
    } finally {
      setMutating(null);
    }
  }

  async function assignEmployee(projectId: string) {
    const employeeId = employeeToAssign[projectId];
    if (!employeeId) return;
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;
    if (employee.assignedProjectIds?.includes(projectId)) {
      setEmployeeToAssign((prev) => ({ ...prev, [projectId]: "" }));
      return;
    }

    setMutating(`employee:${employeeId}`);
    setMembershipError(null);
    try {
      const updated = await apiFetch<EmployeeLite>(
        `/api/employees/${employeeId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            assignedProjectIds: [...(employee.assignedProjectIds ?? []), projectId],
          }),
        }
      );
      setEmployees((prev) =>
        prev.map((e) => (e.id === employeeId ? updated : e))
      );
      const projectName = projects.find((p) => p.id === projectId)?.name ?? projectId;
      void logActivity({
        event_type: "status_change",
        title: `Employee assigned: ${updated.name}`,
        description: `-> project ${projectName}`,
        project_id: projectId,
        metadata: { employeeId: updated.id, employeeName: updated.name },
      });
      setEmployeeToAssign((prev) => ({ ...prev, [projectId]: "" }));
    } catch (err) {
      setMembershipError(
        err instanceof Error ? err.message : "Failed to assign employee"
      );
    } finally {
      setMutating(null);
    }
  }

  async function unassignEmployee(employeeId: string, projectId: string) {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;
    const nextIds = (employee.assignedProjectIds ?? []).filter(
      (id) => id !== projectId
    );

    setMutating(`employee:${employeeId}`);
    setMembershipError(null);
    try {
      const updated = await apiFetch<EmployeeLite>(
        `/api/employees/${employeeId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ assignedProjectIds: nextIds }),
        }
      );
      setEmployees((prev) =>
        prev.map((e) => (e.id === employeeId ? updated : e))
      );
      const projectName = projects.find((p) => p.id === projectId)?.name ?? projectId;
      void logActivity({
        event_type: "status_change",
        title: `Employee unassigned: ${updated.name}`,
        description: `<- project ${projectName}`,
        project_id: projectId,
        metadata: { employeeId: updated.id, employeeName: updated.name },
      });
    } catch (err) {
      setMembershipError(
        err instanceof Error ? err.message : "Failed to unassign employee"
      );
    } finally {
      setMutating(null);
    }
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

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Create
            </p>
            <h2 className="text-lg font-semibold">New Project</h2>
          </div>
          <Button onClick={handleCreate} disabled={submitting || !name || !repo}>
            {submitting ? "Creating..." : "Create project"}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder="GitHub repo (org/name)"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
          />
          <Input
            placeholder="Branch"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          />
          <Input
            placeholder="Short description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {formError && (
          <p className="mt-3 text-sm text-red-400">{formError}</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
          >
            {membershipError && (
              <p className="mb-3 text-sm text-red-400">{membershipError}</p>
            )}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Project
                </p>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-lg font-semibold hover:underline underline-offset-4"
                >
                  {project.name}
                </Link>
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
                  {agents.filter((a) => a.currentProjectId === project.id).length}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2">
                <p className="text-[var(--muted)]">Employees</p>
                <p className="text-sm font-medium">
                  {
                    employees.filter((e) =>
                      e.assignedProjectIds?.includes(project.id)
                    ).length
                  }
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Agents
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {agents
                    .filter((a) => a.currentProjectId === project.id)
                    .map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {agent.name}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {agent.status}
                          </p>
                        </div>
                        <Button
                          className="px-3 py-1 text-xs"
                          disabled={mutating === `agent:${agent.id}`}
                          onClick={() => unassignAgent(agent.id)}
                        >
                          {mutating === `agent:${agent.id}` ? "..." : "Remove"}
                        </Button>
                      </div>
                    ))}
                  {agents.filter((a) => a.currentProjectId === project.id)
                    .length === 0 && (
                    <p className="text-sm text-[var(--muted)]">
                      No agents assigned
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <select
                    className={selectClassName()}
                    value={agentToAssign[project.id] ?? ""}
                    onChange={(event) =>
                      setAgentToAssign((prev) => ({
                        ...prev,
                        [project.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Assign idle agent...</option>
                    {agents
                      .filter((a) => !a.currentProjectId)
                      .map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                  </select>
                  <Button
                    className="px-3 py-2 text-xs"
                    onClick={() => assignAgent(project.id)}
                    disabled={
                      !agentToAssign[project.id] ||
                      mutating?.startsWith("agent:")
                    }
                  >
                    Assign
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Employees
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {employees
                    .filter((e) => e.assignedProjectIds?.includes(project.id))
                    .map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {employee.name}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {employee.role}
                          </p>
                        </div>
                        <Button
                          className="px-3 py-1 text-xs"
                          disabled={mutating === `employee:${employee.id}`}
                          onClick={() =>
                            unassignEmployee(employee.id, project.id)
                          }
                        >
                          {mutating === `employee:${employee.id}` ? "..." : "Remove"}
                        </Button>
                      </div>
                    ))}
                  {employees.filter((e) => e.assignedProjectIds?.includes(project.id))
                    .length === 0 && (
                    <p className="text-sm text-[var(--muted)]">
                      No employees assigned
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <select
                    className={selectClassName()}
                    value={employeeToAssign[project.id] ?? ""}
                    onChange={(event) =>
                      setEmployeeToAssign((prev) => ({
                        ...prev,
                        [project.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Assign employee...</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    className="px-3 py-2 text-xs"
                    onClick={() => assignEmployee(project.id)}
                    disabled={
                      !employeeToAssign[project.id] ||
                      mutating?.startsWith("employee:")
                    }
                  >
                    Assign
                  </Button>
                </div>
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
