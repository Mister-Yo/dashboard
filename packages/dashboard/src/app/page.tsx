"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { BoardView } from "@/components/board/BoardView";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface Blocker {
  id: string;
  description: string;
  severity: string;
  reportedAt: string;
}

interface Achievement {
  id: string;
  description: string;
  achievedAt: string;
}

interface Task {
  id: string;
  status: string;
}

interface ProjectWithDetails extends Project {
  blockers: Blocker[];
  achievements: Achievement[];
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

export default function BoardPage() {
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load(isInitial = false) {
      try {
        if (isInitial) setLoading(true);
        const [p, a, e] = await Promise.all([
          apiFetch<Project[]>("/api/projects"),
          apiFetch<Agent[]>("/api/agents"),
          apiFetch<Employee[]>("/api/employees"),
        ]);
        const detailed = await Promise.all(
          p.map(async (project) => {
            try {
              const detail = await apiFetch<Project & { blockers: Blocker[]; achievements: Achievement[] }>(
                `/api/projects/${project.id}`
              );
              const tasks = await apiFetch<Task[]>(
                `/api/tasks?projectId=${project.id}`
              );
              const summary = tasks.reduce(
                (acc, task) => {
                  const status = task.status as keyof typeof acc;
                  if (acc[status] !== undefined) {
                    acc[status] += 1;
                  }
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

              return {
                ...project,
                blockers: detail.blockers ?? [],
                achievements: detail.achievements ?? [],
                taskSummary: summary,
              };
            } catch {
              return {
                ...project,
                blockers: [],
                achievements: [],
                taskSummary: {
                  pending: 0,
                  in_progress: 0,
                  review: 0,
                  blocked: 0,
                  completed: 0,
                },
              };
            }
          })
        );

        setProjects(detailed);
        setAgents(a);
        setEmployees(e);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (isInitial) setLoading(false);
      }
    }

    load(true);
    timer = setInterval(() => load(false), 15000);

    return () => {
      if (timer) clearInterval(timer);
    };
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

  return <BoardView projects={projects} agents={agents} employees={employees} />;
}
