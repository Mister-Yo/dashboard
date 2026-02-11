"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAgents } from "@/hooks/use-api";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FadeIn, FadeInStagger, FadeInItem } from "@/components/ui/fade-in";
import { PageHeader } from "@/components/layout/page-header";

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  currentProjectId: string | null;
  currentTaskId: string | null;
  lastHeartbeat: string | null;
  permissions: string[];
}

function formatTime(value: string | null) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function timeAgo(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentsPage() {
  const {
    data: agents = [],
    isLoading: loading,
    error: agentsError,
    refetch,
  } = useAgents();

  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("custom");
  const [permissions, setPermissions] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const queryClient = useQueryClient();
  const createAgent = useMutation({
    mutationFn: (data: { name: string; type: string; permissions: string[] }) =>
      apiFetch<{ agent: Agent; apiKey?: string }>("/api/agents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      if (result.apiKey) {
        setApiKey(result.apiKey);
      }
      setName("");
      setType("custom");
      setPermissions("");
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    },
  });

  const summary = useMemo(() => {
    const total = agents.length;
    const active = agents.filter((a) => a.status === "active").length;
    const idle = agents.filter((a) => a.status === "idle").length;
    const errored = agents.filter((a) => a.status === "error").length;
    return { total, active, idle, errored };
  }, [agents]);

  /* ── Loading ──────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          label="Agents"
          title="Agent Fleet"
          description="Monitor autonomous workers, their roles, and their latest heartbeat."
        />
        <SkeletonGrid count={6} />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────── */
  if (agentsError) {
    return (
      <div className="space-y-8">
        <PageHeader
          label="Agents"
          title="Agent Fleet"
          description="Monitor autonomous workers, their roles, and their latest heartbeat."
        />
        <ErrorState
          message="Failed to connect to API"
          detail={agentsError?.message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── Handlers ─────────────────────────────────────────── */
  function handleCreate() {
    setFormError(null);
    setApiKey(null);
    setCopied(false);
    createAgent.mutate({
      name,
      type,
      permissions: permissions
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    });
  }

  async function handleCopy() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  /* ── Render ───────────────────────────────────────────── */
  return (
    <FadeIn>
      <div className="space-y-8">
        <PageHeader
          label="Agents"
          title="Agent Fleet"
          description="Monitor autonomous workers, their roles, and their latest heartbeat."
          stats={[
            { label: "total", value: summary.total, color: "muted" as const },
            { label: "active", value: summary.active, color: "success" as const },
            { label: "idle", value: summary.idle, color: "warning" as const },
            { label: "error", value: summary.errored, color: "danger" as const },
          ]}
        />

        {/* ── Create Agent ──────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Create
              </p>
              <h2 className="text-lg font-semibold">New Agent</h2>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createAgent.isPending || !name}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              {createAgent.isPending ? "Creating..." : "Create agent"}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Agent name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            />
            <Input
              placeholder="Type (e.g. claude_code)"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            />
            <Input
              placeholder="Permissions (comma separated)"
              value={permissions}
              onChange={(event) => setPermissions(event.target.value)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            />
          </div>
          {apiKey && (
            <div className="mt-4 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                API Key (show once)
              </p>
              <p className="text-sm mt-2 break-all">{apiKey}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  onClick={handleCopy}
                  className="px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                >
                  {copied ? "Copied" : "Copy key"}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  Save now. It will not be shown again.
                </span>
              </div>
            </div>
          )}
          {formError && (
            <p className="mt-3 text-sm text-red-400">{formError}</p>
          )}
        </section>

        {/* ── Agent Grid ────────────────────────────────── */}
        {agents.length === 0 ? (
          <EmptyState
            icon="🤖"
            title="No agents registered yet"
            description="Create your first agent above to get started."
            className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)]"
          />
        ) : (
          <FadeInStagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <FadeInItem key={agent.id}>
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Agent
                      </p>
                      <h3 className="text-lg font-semibold">{agent.name}</h3>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {agent.type}
                      </p>
                    </div>
                    <StatusPill status={agent.status} />
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-[var(--muted)]">
                    <div className="flex items-center justify-between">
                      <span>Heartbeat</span>
                      <span
                        className="text-[var(--foreground)]"
                        title={formatTime(agent.lastHeartbeat)}
                      >
                        {timeAgo(agent.lastHeartbeat) ?? formatTime(agent.lastHeartbeat)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Project</span>
                      <span className="text-[var(--foreground)]">
                        {agent.currentProjectId ?? "\u2014"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Task</span>
                      <span className="text-[var(--foreground)]">
                        {agent.currentTaskId ?? "\u2014"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
                    <p className="text-[var(--muted)]">Permissions</p>
                    <p className="text-sm font-medium">
                      {agent.permissions?.length
                        ? agent.permissions.join(", ")
                        : "No permissions set"}
                    </p>
                  </div>

                  <div className="mt-3">
                    <Link
                      href={`/agents/${agent.id}/chat`}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition hover:bg-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                    >
                      Chat
                    </Link>
                  </div>
                </div>
              </FadeInItem>
            ))}
          </FadeInStagger>
        )}
      </div>
    </FadeIn>
  );
}
