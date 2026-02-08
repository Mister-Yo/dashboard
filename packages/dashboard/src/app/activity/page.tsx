"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

interface WorkEntity {
  id: string;
  name: string;
  entityType: "agent" | "employee";
  workStatus: "working" | "idle" | "off" | "waiting";
  role?: string;
  type?: string;
  currentTaskId?: string | null;
  currentTaskDescription?: string | null;
  lastHeartbeat?: string | null;
}

interface ActivityEvent {
  id: string;
  actorType: string;
  actorId: string;
  actorName: string;
  eventType: string;
  title: string;
  description: string;
  projectId: string | null;
  taskId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; pulse: boolean; label: string; icon: string }
> = {
  working: {
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    pulse: true,
    label: "Working",
    icon: "\u{1F7E2}",
  },
  idle: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    pulse: false,
    label: "Idle",
    icon: "\u{1F534}",
  },
  off: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
    pulse: false,
    label: "Day Off",
    icon: "\u{1F535}",
  },
  waiting: {
    color: "#f97316",
    bg: "rgba(249,115,22,0.15)",
    pulse: true,
    label: "Waiting",
    icon: "\u{1F7E0}",
  },
};

const EVENT_ICONS: Record<string, string> = {
  start_task: "\u25B6",
  finish_task: "\u2714",
  status_change: "\u26A1",
  note: "\u{1F4DD}",
  blocker: "\u{1F6A7}",
  deploy: "\u{1F680}",
  commit: "\u{1F4E6}",
  review: "\u{1F50D}",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityPage() {
  const [entities, setEntities] = useState<WorkEntity[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "working" | "idle" | "waiting" | "off">("all");

  async function loadData() {
    try {
      const [statusData, eventsData] = await Promise.all([
        apiFetch<{ agents: WorkEntity[]; employees: WorkEntity[] }>(
          "/api/activity/status"
        ),
        apiFetch<ActivityEvent[]>("/api/activity?limit=100"),
      ]);

      const all = [
        ...statusData.agents,
        ...statusData.employees,
      ];
      setEntities(all);
      setEvents(eventsData);
    } catch (err) {
      console.error("Failed to load activity data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? entities : entities.filter((e) => e.workStatus === filter)),
    [entities, filter]
  );

  const counts = useMemo(() => {
    const c = { working: 0, idle: 0, off: 0, waiting: 0 };
    for (const e of entities) {
      if (e.workStatus in c) c[e.workStatus as keyof typeof c]++;
    }
    return c;
  }, [entities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading activity monitor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-3rem)]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Activity Monitor</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Real-time work status and event stream
        </p>
      </div>

      {/* Status summary bar */}
      <div className="flex gap-3 flex-wrap">
        {(["all", "working", "idle", "waiting", "off"] as const).map((key) => {
          const isAll = key === "all";
          const count = isAll ? entities.length : counts[key];
          const cfg = isAll ? null : STATUS_CONFIG[key];
          const active = filter === key;

          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border"
              style={{
                borderColor: active
                  ? cfg?.color ?? "var(--accent)"
                  : "var(--card-border)",
                backgroundColor: active
                  ? cfg?.bg ?? "var(--accent)"
                  : "var(--surface)",
                color: active
                  ? cfg?.color ?? "var(--accent-foreground)"
                  : "var(--muted)",
              }}
            >
              {cfg && <span>{cfg.icon}</span>}
              {isAll ? "All" : cfg?.label}
              <span
                className="ml-1 text-xs font-bold rounded-full px-2 py-0.5"
                style={{
                  backgroundColor: cfg?.bg ?? "var(--surface-2)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 grid gap-6 xl:grid-cols-[1fr,400px] overflow-hidden">
        {/* Left: People grid */}
        <div className="overflow-auto">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entity) => {
              const cfg = STATUS_CONFIG[entity.workStatus] ?? STATUS_CONFIG.idle;
              return (
                <div
                  key={`${entity.entityType}-${entity.id}`}
                  className="rounded-2xl border p-4 transition-all hover:scale-[1.01]"
                  style={{
                    borderColor: cfg.color + "40",
                    backgroundColor: "var(--surface)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="relative h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: cfg.bg,
                          color: cfg.color,
                        }}
                      >
                        {entity.name.slice(0, 2).toUpperCase()}
                        {/* Pulsing dot */}
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)]"
                          style={{
                            backgroundColor: cfg.color,
                            animation: cfg.pulse
                              ? "pulse 2s ease-in-out infinite"
                              : "none",
                          }}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{entity.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                          {entity.entityType === "agent"
                            ? entity.type ?? "agent"
                            : entity.role ?? "employee"}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-lg"
                      style={{
                        color: cfg.color,
                        backgroundColor: cfg.bg,
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {entity.currentTaskDescription && (
                    <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2 leading-relaxed">
                      {entity.currentTaskDescription}
                    </p>
                  )}

                  {entity.lastHeartbeat && (
                    <p className="text-[10px] text-[var(--muted)] mt-2">
                      Last seen: {timeAgo(entity.lastHeartbeat)}
                    </p>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-[var(--muted)] text-sm">
                No team members with this status
              </div>
            )}
          </div>
        </div>

        {/* Right: Event stream */}
        <div className="flex flex-col rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--card-border)] bg-[var(--surface-2)]/50">
            <h3 className="text-sm font-semibold">Event Stream</h3>
            <p className="text-[10px] text-[var(--muted)]">
              {events.length} events &middot; auto-refresh 10s
            </p>
          </div>

          <div className="flex-1 overflow-auto">
            {events.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-[var(--muted)] text-sm">
                  <p className="text-3xl mb-2">{"\u{1F4ED}"}</p>
                  <p>No events yet</p>
                  <p className="text-xs mt-1">
                    Events appear when agents/employees log activity
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--card-border)]">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="px-4 py-3 hover:bg-[var(--surface-2)]/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-base mt-0.5">
                        {EVENT_ICONS[event.eventType] ?? "\u25CF"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[var(--foreground)]">
                            {event.actorName}
                          </span>
                          <span className="text-[10px] text-[var(--muted)] whitespace-nowrap">
                            {formatTime(event.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--foreground)] mt-0.5 leading-snug">
                          {event.title}
                        </p>
                        {event.description && (
                          <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}
