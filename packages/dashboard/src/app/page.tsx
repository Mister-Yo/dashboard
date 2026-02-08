"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  assignedAgentIds: string[];
  assignedEmployeeIds: string[];
}

interface Agent {
  id: string;
  name: string;
  status: string;
  currentProjectId: string | null;
  currentTaskId: string | null;
  lastHeartbeat: string | null;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
  assignedProjectIds: string[];
}

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  working: "bg-blue-500",
  idle: "bg-yellow-500",
  error: "bg-red-500",
  paused: "bg-yellow-500",
  completed: "bg-green-500",
  blocked: "bg-red-500",
  inactive: "bg-gray-500",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${statusColors[status] ?? "bg-gray-500"}`}
    />
  );
}

export default function BoardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [p, a, e] = await Promise.all([
          apiFetch<Project[]>("/api/projects"),
          apiFetch<Agent[]>("/api/agents"),
          apiFetch<Employee[]>("/api/employees"),
        ]);
        setProjects(p);
        setAgents(a);
        setEmployees(e);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading dashboard...</p>
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Board</h1>
        <div className="flex gap-4 text-sm text-[var(--muted)]">
          <span>
            {projects.length} projects
          </span>
          <span>
            {agents.length} agents
          </span>
          <span>
            {employees.length} employees
          </span>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {projects.map((project) => {
          const projectAgents = agents.filter(
            (a) => a.currentProjectId === project.id
          );
          const projectEmployees = employees.filter((e) =>
            e.assignedProjectIds?.includes(project.id)
          );

          return (
            <div
              key={project.id}
              className="border border-[var(--card-border)] bg-[var(--card)] rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{project.name}</h3>
                <StatusDot status={project.status} />
              </div>
              <p className="text-sm text-[var(--muted)] mb-3 line-clamp-2">
                {project.description || "No description"}
              </p>

              {projectAgents.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-[var(--muted)] mb-1">Agents:</p>
                  {projectAgents.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <StatusDot status={a.status} />
                      <span>{a.name}</span>
                      <span className="text-xs text-[var(--muted)]">
                        ({a.status})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {projectEmployees.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">
                    Employees:
                  </p>
                  {projectEmployees.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <StatusDot status={e.status} />
                      <span>{e.name}</span>
                      <span className="text-xs text-[var(--muted)]">
                        ({e.role})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="col-span-full text-center py-12 text-[var(--muted)]">
            No projects yet. Create one to get started.
          </div>
        )}
      </div>

      {/* Agents & Employees Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-[var(--card-border)] bg-[var(--card)] rounded-lg p-4">
          <h3 className="font-semibold mb-3">Agents</h3>
          {agents.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No agents registered</p>
          ) : (
            agents.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 border-b border-[var(--card-border)] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={a.status} />
                  <span className="text-sm">{a.name}</span>
                </div>
                <span className="text-xs text-[var(--muted)]">{a.status}</span>
              </div>
            ))
          )}
        </div>

        <div className="border border-[var(--card-border)] bg-[var(--card)] rounded-lg p-4">
          <h3 className="font-semibold mb-3">Employees</h3>
          {employees.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No employees registered
            </p>
          ) : (
            employees.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between py-2 border-b border-[var(--card-border)] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={e.status} />
                  <span className="text-sm">{e.name}</span>
                </div>
                <span className="text-xs text-[var(--muted)]">{e.role}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
