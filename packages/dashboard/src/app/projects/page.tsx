"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useProjects, useAgents, useEmployees, useCreateProject } from "@/hooks/use-api";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, FadeInStagger, FadeInItem } from "@/components/ui/fade-in";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardHeader, CardTitle, CardContent, CardStat, CardFooter } from "@/components/ui/card";
import { ToggleSection } from "@/components/ui/toggle-section";

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

function selectClassName() {
  return cn(
    "w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3 text-sm",
    "text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // ─── React Query: data fetching ───────────────────────
  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();

  const {
    data: agents = [],
    isLoading: agentsLoading,
    error: agentsError,
    refetch: refetchAgents,
  } = useAgents();

  const {
    data: employees = [],
    isLoading: employeesLoading,
    error: employeesError,
    refetch: refetchEmployees,
  } = useEmployees();

  const loading = projectsLoading || agentsLoading || employeesLoading;
  const error = projectsError || agentsError || employeesError;

  // ─── Local UI state ───────────────────────────────────
  const [formError, setFormError] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [agentToAssign, setAgentToAssign] = useState<Record<string, string>>({});
  const [employeeToAssign, setEmployeeToAssign] = useState<Record<string, string>>({});

  // ─── Mutations ────────────────────────────────────────

  const createProject = useCreateProject();

  const archiveMutation = useMutation({
    mutationFn: ({ projectId, newStatus }: { projectId: string; newStatus: string }) =>
      apiFetch<Project>(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      }),
    onMutate: ({ projectId }) => {
      setMutating(`archive:${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      setMembershipError(err instanceof Error ? err.message : "Failed to archive");
    },
    onSettled: () => {
      setMutating(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/api/projects/${projectId}`, { method: "DELETE" }),
    onMutate: (projectId) => {
      setMutating(`delete:${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      setMembershipError(err instanceof Error ? err.message : "Failed to delete — check for linked tasks");
    },
    onSettled: () => {
      setMutating(null);
    },
  });

  const assignAgentMutation = useMutation({
    mutationFn: ({ agentId, projectId }: { agentId: string; projectId: string }) =>
      apiFetch<AgentLite>(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({ currentProjectId: projectId }),
      }),
    onMutate: ({ agentId }) => {
      setMutating(`agent:${agentId}`);
      setMembershipError(null);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setAgentToAssign((prev) => ({ ...prev, [projectId]: "" }));
    },
    onError: (err) => {
      setMembershipError(err instanceof Error ? err.message : "Failed to assign agent");
    },
    onSettled: () => {
      setMutating(null);
    },
  });

  const unassignAgentMutation = useMutation({
    mutationFn: (agentId: string) =>
      apiFetch<AgentLite>(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({ currentProjectId: null }),
      }),
    onMutate: (agentId) => {
      setMutating(`agent:${agentId}`);
      setMembershipError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      setMembershipError(err instanceof Error ? err.message : "Failed to unassign agent");
    },
    onSettled: () => {
      setMutating(null);
    },
  });

  const assignEmployeeMutation = useMutation({
    mutationFn: ({ employeeId, newProjectIds }: { employeeId: string; newProjectIds: string[]; projectId: string }) =>
      apiFetch<EmployeeLite>(`/api/employees/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify({ assignedProjectIds: newProjectIds }),
      }),
    onMutate: ({ employeeId }) => {
      setMutating(`employee:${employeeId}`);
      setMembershipError(null);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEmployeeToAssign((prev) => ({ ...prev, [projectId]: "" }));
    },
    onError: (err) => {
      setMembershipError(err instanceof Error ? err.message : "Failed to assign employee");
    },
    onSettled: () => {
      setMutating(null);
    },
  });

  const unassignEmployeeMutation = useMutation({
    mutationFn: ({ employeeId, nextIds }: { employeeId: string; nextIds: string[] }) =>
      apiFetch<EmployeeLite>(`/api/employees/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify({ assignedProjectIds: nextIds }),
      }),
    onMutate: ({ employeeId }) => {
      setMutating(`employee:${employeeId}`);
      setMembershipError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      setMembershipError(err instanceof Error ? err.message : "Failed to unassign employee");
    },
    onSettled: () => {
      setMutating(null);
    },
  });

  // ─── Handlers ─────────────────────────────────────────

  function handleCreate() {
    setFormError(null);
    createProject.mutate(
      { name, description, githubRepo: repo, githubBranch: branch },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setRepo("");
          setBranch("main");
        },
        onError: (err) => {
          setFormError(err instanceof Error ? err.message : "Failed to create");
        },
      }
    );
  }

  function handleArchive(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    const newStatus = project?.status === "archived" ? "active" : "archived";
    archiveMutation.mutate({ projectId, newStatus });
  }

  function handleDelete(projectId: string) {
    deleteMutation.mutate(projectId);
  }

  function assignAgent(projectId: string) {
    const agentId = agentToAssign[projectId];
    if (!agentId) return;
    assignAgentMutation.mutate({ agentId, projectId });
  }

  function unassignAgent(agentId: string) {
    unassignAgentMutation.mutate(agentId);
  }

  function assignEmployee(projectId: string) {
    const employeeId = employeeToAssign[projectId];
    if (!employeeId) return;
    const employee = employees.find((e: EmployeeLite) => e.id === employeeId);
    if (!employee) return;
    if (employee.assignedProjectIds?.includes(projectId)) {
      setEmployeeToAssign((prev) => ({ ...prev, [projectId]: "" }));
      return;
    }
    const newProjectIds = [...(employee.assignedProjectIds ?? []), projectId];
    assignEmployeeMutation.mutate({ employeeId, newProjectIds, projectId });
  }

  function unassignEmployee(employeeId: string, projectId: string) {
    const employee = employees.find((e: EmployeeLite) => e.id === employeeId);
    if (!employee) return;
    const nextIds = (employee.assignedProjectIds ?? []).filter((id: string) => id !== projectId);
    unassignEmployeeMutation.mutate({ employeeId, nextIds });
  }

  // ─── Derived data ─────────────────────────────────────

  const summary = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p: Project) => p.status === "active").length;
    const blocked = projects.filter((p: Project) => p.status === "blocked").length;
    const archived = projects.filter((p: Project) => p.status === "archived").length;
    return { total, active, blocked, archived };
  }, [projects]);

  const submitting = createProject.isPending;

  if (loading) {
    return (
      <FadeIn>
        <PageHeader label="Projects" title="Active Portfolio" />
        <SkeletonGrid count={6} />
      </FadeIn>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load projects";
    return (
      <ErrorState
        message="Failed to connect to API"
        detail={errorMessage}
        onRetry={() => {
          refetchProjects();
          refetchAgents();
          refetchEmployees();
        }}
      />
    );
  }

  // Sort: active first, then archived
  const sortedProjects = [...projects].sort((a: Project, b: Project) => {
    if (a.status === "archived" && b.status !== "archived") return 1;
    if (a.status !== "archived" && b.status === "archived") return -1;
    return 0;
  });

  return (
    <FadeIn>
      <div className="space-y-8">
        <PageHeader
          label="Projects"
          title="Active Portfolio"
          description="Track the strategic initiatives, ownership, and the current health of each project."
          stats={[
            { label: "total", value: summary.total, color: "muted" as const },
            { label: "active", value: summary.active, color: "success" as const },
            { label: "blocked", value: summary.blocked, color: "danger" as const },
            ...(summary.archived > 0
              ? [{ label: "archived", value: summary.archived, color: "muted" as const }]
              : []),
          ]}
        />

        <ToggleSection
          title="Create"
          description="Launch new strategic initiatives"
          buttonText="New Project"
          icon="⌂"
        >
          <div className="space-y-4">
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
            
            <Button 
              onClick={handleCreate} 
              disabled={submitting || !name || !repo}
              className="w-full"
            >
              {submitting ? "Creating..." : "Create Project"}
            </Button>
            
            {formError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                {formError}
              </p>
            )}
          </div>
        </ToggleSection>

        <FadeInStagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedProjects.map((project: Project) => {
            const isArchived = project.status === "archived";
            const projectAgents = agents.filter((a: AgentLite) => a.currentProjectId === project.id);
            const projectEmployees = employees.filter((e: EmployeeLite) => e.assignedProjectIds?.includes(project.id));

            return (
              <FadeInItem key={project.id}>
                <Card hover glow className={cn(isArchived && "opacity-50")}>
                  {membershipError && (
                    <p className="mb-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                      {membershipError}
                    </p>
                  )}

                  <CardHeader>
                    <CardTitle 
                      label="Project" 
                      className="cursor-pointer group flex-1"
                      onClick={() => router.push(`/tasks?projectId=${project.id}`)}
                    >
                      <span className="group-hover:text-[var(--accent)] transition-colors">
                        {project.name}
                      </span>
                    </CardTitle>
                    <StatusPill status={project.status} />
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm text-[var(--muted)] line-clamp-2 mb-4">
                      {project.description || "No description yet."}
                    </p>

                    <div className="space-y-2">
                      <CardStat 
                        label="Repo" 
                        value={project.githubRepo.length > 20 ? project.githubRepo.slice(0, 20) + "..." : project.githubRepo}
                      />
                      <CardStat label="Branch" value={project.githubBranch} />
                      {project.strategyPath && (
                        <CardStat label="Strategy" value={project.strategyPath} />
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2 text-center">
                        <p className="text-xs text-[var(--muted)]">Agents</p>
                        <p className="text-lg font-semibold text-[var(--accent)]">{projectAgents.length}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2 text-center">
                        <p className="text-xs text-[var(--muted)]">Employees</p>
                        <p className="text-lg font-semibold text-[var(--accent)]">{projectEmployees.length}</p>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => router.push(`/tasks?projectId=${project.id}`)}
                        className="flex-1 text-xs font-medium px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                      >
                        Tasks
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(project.id); }}
                        disabled={mutating === `archive:${project.id}`}
                        className="text-xs font-medium px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-amber-500/40 hover:text-amber-400 transition-all disabled:opacity-50"
                      >
                        {mutating === `archive:${project.id}` ? "..." : isArchived ? "Restore" : "Archive"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(project.id); }}
                        className="text-xs font-medium px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-red-500/40 hover:text-red-400 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </CardFooter>

                {/* Agents & Employees assignment (collapse for archived) */}
                {!isArchived && (
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Agents
                      </p>
                      <div className="mt-2 flex flex-col gap-2">
                        {projectAgents.map((agent: AgentLite) => (
                          <div key={agent.id} className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-[var(--foreground)]">{agent.name}</p>
                              <p className="text-xs text-[var(--muted)]">{agent.status}</p>
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
                        {projectAgents.length === 0 && (
                          <p className="text-sm text-[var(--muted)]">No agents assigned</p>
                        )}
                      </div>

                      <div className="mt-3 flex items-end gap-2">
                        <select
                          className={selectClassName()}
                          value={agentToAssign[project.id] ?? ""}
                          onChange={(event) =>
                            setAgentToAssign((prev) => ({ ...prev, [project.id]: event.target.value }))
                          }
                        >
                          <option value="">Assign idle agent...</option>
                          {agents
                            .filter((a: AgentLite) => !a.currentProjectId)
                            .map((agent: AgentLite) => (
                              <option key={agent.id} value={agent.id}>{agent.name}</option>
                            ))}
                        </select>
                        <Button
                          className="px-3 py-2 text-xs"
                          onClick={() => assignAgent(project.id)}
                          disabled={!agentToAssign[project.id] || mutating?.startsWith("agent:")}
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
                        {projectEmployees.map((employee: EmployeeLite) => (
                          <div key={employee.id} className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-[var(--foreground)]">{employee.name}</p>
                              <p className="text-xs text-[var(--muted)]">{employee.role}</p>
                            </div>
                            <Button
                              className="px-3 py-1 text-xs"
                              disabled={mutating === `employee:${employee.id}`}
                              onClick={() => unassignEmployee(employee.id, project.id)}
                            >
                              {mutating === `employee:${employee.id}` ? "..." : "Remove"}
                            </Button>
                          </div>
                        ))}
                        {projectEmployees.length === 0 && (
                          <p className="text-sm text-[var(--muted)]">No employees assigned</p>
                        )}
                      </div>

                      <div className="mt-3 flex items-end gap-2">
                        <select
                          className={selectClassName()}
                          value={employeeToAssign[project.id] ?? ""}
                          onChange={(event) =>
                            setEmployeeToAssign((prev) => ({ ...prev, [project.id]: event.target.value }))
                          }
                        >
                          <option value="">Assign employee...</option>
                          {employees.map((employee: EmployeeLite) => (
                            <option key={employee.id} value={employee.id}>{employee.name}</option>
                          ))}
                        </select>
                        <Button
                          className="px-3 py-2 text-xs"
                          onClick={() => assignEmployee(project.id)}
                          disabled={!employeeToAssign[project.id] || mutating?.startsWith("employee:")}
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                </Card>
              </FadeInItem>
            );
          })}

          {projects.length === 0 && (
            <EmptyState
              icon="📁"
              title="No projects created yet"
              description="Add one above to begin."
              className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)]"
            />
          )}
        </FadeInStagger>

        <ConfirmDialog
          open={deleteTarget !== null}
          onConfirm={() => {
            if (deleteTarget) handleDelete(deleteTarget);
          }}
          onCancel={() => setDeleteTarget(null)}
          title="Delete Project"
          description="This will permanently delete this project. This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          loading={deleteMutation.isPending}
        />
      </div>
    </FadeIn>
  );
}
