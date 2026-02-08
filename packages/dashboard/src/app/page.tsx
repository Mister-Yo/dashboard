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

  return <BoardView projects={projects} agents={agents} employees={employees} />;
}
