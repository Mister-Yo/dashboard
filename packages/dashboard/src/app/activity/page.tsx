"use client";

import { useMemo, useState } from "react";
import { useActivityStatus, useActivityEvents } from "@/hooks/use-api";
import { FadeIn, FadeInStagger, FadeInItem } from "@/components/ui/fade-in";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardStat } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────── */

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

/* ─── Status & Avatar config ─────────────────────────────── */

const STATUS_CONFIG: Record<string, { color: string; bg: string; glow: string; label: string; animation?: string }> = {
  working: { 
    color: "#34d399", 
    bg: "rgba(34,211,153,0.12)", 
    glow: "0 0 20px rgba(34,211,153,0.45)", 
    label: "Working",
    animation: "animate-pulse"
  },
  idle: { 
    color: "#64748b", 
    bg: "rgba(100,116,139,0.1)", 
    glow: "none", 
    label: "Idle" 
  },
  off: { 
    color: "#475569", 
    bg: "rgba(71,85,105,0.1)", 
    glow: "none", 
    label: "Offline" 
  },
  waiting: { 
    color: "#fbbf24", 
    bg: "rgba(251,191,36,0.12)", 
    glow: "0 0 16px rgba(251,191,36,0.35)", 
    label: "Waiting",
    animation: "animate-bounce"
  },
};

const AVATARS: Record<string, { char: string; gradient: [string, string]; bg: string }> = {
  CLAUDE: { char: "C", gradient: ["#8b5cf6", "#6d28d9"], bg: "from-purple-500 to-purple-700" },
  CODE:   { char: "X", gradient: ["#06b6d4", "#0891b2"], bg: "from-cyan-500 to-cyan-700" },
  QA:     { char: "Q", gradient: ["#f59e0b", "#d97706"], bg: "from-amber-500 to-amber-700" },
  CEO:    { char: "B", gradient: ["#f6c453", "#e5a91a"], bg: "from-yellow-500 to-yellow-600" },
  AGENT:  { char: "A", gradient: ["#10b981", "#059669"], bg: "from-emerald-500 to-emerald-700" },
};

const EVENT_ICONS: Record<string, string> = {
  start_task: "▶", finish_task: "✓", status_change: "⚡", note: "✎",
  blocker: "⛔", deploy: "🚀", commit: "●", review: "◉",
  heartbeat: "💓", message: "💬", alert: "🚨"
};

/* ─── Status Card Component ──────────────────────────────── */

function StatusCard({ entity, selected, onClick }: {
  entity: WorkEntity; 
  selected: boolean; 
  onClick: () => void;
}) {
  const status = STATUS_CONFIG[entity.workStatus] ?? STATUS_CONFIG.idle;
  const key = entity.entityType === "agent" ? 
    (entity.name.toUpperCase().includes("CLAUDE") ? "CLAUDE" : 
     entity.name.toUpperCase().includes("CODE") ? "CODE" : "AGENT") :
    (entity.role?.toUpperCase() ?? "CEO");
  const avatar = AVATARS[key] ?? AVATARS.CEO;

  return (
    <Card 
      hover 
      glow={selected}
      onClick={onClick}
      className={cn(
        "transition-all duration-300 cursor-pointer",
        selected && "ring-2 ring-[var(--accent)]/50 border-[var(--accent)]/50",
        status.animation && entity.workStatus === "working" && status.animation
      )}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div 
            className={cn(
              "relative w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg bg-gradient-to-br",
              avatar.bg
            )}
            style={{
              boxShadow: entity.workStatus === "working" ? status.glow : "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            }}
          >
            {avatar.char}
            {/* Status indicator */}
            <div 
              className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--surface)]",
                entity.workStatus === "working" && "animate-pulse"
              )}
              style={{ 
                backgroundColor: status.color,
                boxShadow: entity.workStatus === "working" ? `0 0 8px ${status.color}` : "none"
              }}
            />
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <CardTitle>
              <span className="truncate">{entity.name}</span>
              <p className="text-xs text-[var(--muted)] font-normal mt-1">
                {entity.entityType === "agent" ? 
                  (entity.type ?? "agent").replace(/_/g, " ") : 
                  entity.role ?? "employee"}
              </p>
            </CardTitle>
          </div>

          {/* Status badge */}
          <div 
            className="px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ 
              backgroundColor: status.bg, 
              color: status.color,
              border: `1px solid ${status.color}25`
            }}
          >
            {status.label}
          </div>
        </div>
      </CardHeader>

      {entity.currentTaskDescription && (
        <CardContent className="pt-0">
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--card-border)]">
            <p className="text-xs text-[var(--muted)] mb-1 uppercase tracking-wide">Current Task</p>
            <p className="text-sm leading-relaxed line-clamp-2">{entity.currentTaskDescription}</p>
          </div>
        </CardContent>
      )}

      <div className="px-4 pb-4">
        <CardStat 
          label="Last Heartbeat" 
          value={formatTimeAgo(entity.lastHeartbeat ?? null)}
        />
      </div>
    </Card>
  );
}

/* ─── Event Stream ───────────────────────────────────────── */

function EventStream({ events }: { events: ActivityEvent[] }) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle label="Intelligence">
          <div className="flex items-center gap-2">
            <span>Live Event Stream</span>
            {events.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-[var(--muted)] tabular-nums">{events.length}</span>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <div className="flex-1 overflow-auto px-4 pb-4">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted)]">
            <div className="text-center">
              <div className="text-2xl mb-2">📡</div>
              <p className="text-sm">No events yet</p>
              <p className="text-xs opacity-50">Waiting for activity...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, i) => {
              const isAgent = event.actorType === "agent";
              const key = event.actorName?.toUpperCase();
              const avatar = AVATARS[key] ?? (isAgent ? AVATARS.AGENT : AVATARS.CEO);
              return (
                <div key={event.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-[var(--surface-2)]/50",
                    i === 0 && "bg-[var(--surface-2)]/30"
                  )}
                  style={{ 
                    animation: i === 0 ? "fadeIn 0.5s ease-out" : "none" 
                  }}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br shrink-0 mt-0.5",
                    avatar.bg
                  )}>
                    {avatar.char}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold" style={{ color: avatar.gradient[0] }}>
                        {event.actorName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs opacity-60">
                          {EVENT_ICONS[event.eventType] ?? "●"}
                        </span>
                        <span className="text-xs text-[var(--muted)] tabular-nums">
                          {formatTimeAgo(event.createdAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--muted)] line-clamp-2 mt-1">
                      {event.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export default function ActivityPage() {
  const { data: statusData, isLoading: statusLoading } = useActivityStatus();
  const { data: events = [], isLoading: eventsLoading } = useActivityEvents();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loading = statusLoading || eventsLoading;

  const entities = useMemo(() => {
    if (!statusData) return [];
    return [...statusData.agents, ...statusData.employees] as WorkEntity[];
  }, [statusData]);

  const agents = useMemo(() => entities.filter(e => e.entityType === "agent"), [entities]);
  const employees = useMemo(() => entities.filter(e => e.entityType === "employee"), [entities]);
  const selected = useMemo(() => selectedId ? entities.find(e => e.id === selectedId) ?? null : null, [entities, selectedId]);

  const statusCounts = useMemo(() => {
    const counts = { working: 0, idle: 0, off: 0, waiting: 0, total: 0 };
    entities.forEach(e => {
      counts.total++;
      if (e.workStatus in counts) {
        counts[e.workStatus as keyof typeof counts]++;
      }
    });
    return counts;
  }, [entities]);

  if (loading) {
    return (
      <FadeIn>
        <PageHeader label="Command" title="Mission Control" description="Live operational overview and team status" />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="flex flex-col h-[calc(100vh-3rem)] gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              🎯 Mission Control
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">Live operational overview and team status</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-full">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400">LIVE</span>
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center gap-2">
          {(["working", "waiting", "idle", "off"] as const).map(statusKey => {
            const count = statusCounts[statusKey];
            const config = STATUS_CONFIG[statusKey];
            if (!count) return null;
            return (
              <div key={statusKey} 
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border"
                style={{ 
                  color: config.color, 
                  borderColor: `${config.color}25`, 
                  backgroundColor: config.bg 
                }}
              >
                <div 
                  className={cn("h-1.5 w-1.5 rounded-full", config.animation)}
                  style={{ backgroundColor: config.color }} 
                />
                <span>{count} {config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid gap-4 lg:grid-cols-3 overflow-hidden min-h-0">
        
        {/* Status cards grid - takes 2/3 of space on large screens */}
        <div className="lg:col-span-2 overflow-auto">
          <div className="space-y-4">
            {/* Agents section */}
            {agents.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-purple-400">◈</span> AI Agents ({agents.length})
                </h2>
                <FadeInStagger className="grid gap-3 sm:grid-cols-2">
                  {agents.map((agent) => (
                    <FadeInItem key={agent.id}>
                      <StatusCard
                        entity={agent}
                        selected={selectedId === agent.id}
                        onClick={() => setSelectedId(selectedId === agent.id ? null : agent.id)}
                      />
                    </FadeInItem>
                  ))}
                </FadeInStagger>
              </div>
            )}

            {/* Employees section */}
            {employees.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-amber-400">◇</span> Human Team ({employees.length})
                </h2>
                <FadeInStagger className="grid gap-3 sm:grid-cols-2">
                  {employees.map((employee) => (
                    <FadeInItem key={employee.id}>
                      <StatusCard
                        entity={employee}
                        selected={selectedId === employee.id}
                        onClick={() => setSelectedId(selectedId === employee.id ? null : employee.id)}
                      />
                    </FadeInItem>
                  ))}
                </FadeInStagger>
              </div>
            )}

            {entities.length === 0 && (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <div className="text-4xl mb-4">🏢</div>
                  <h3 className="text-lg font-semibold mb-2">No team members found</h3>
                  <p className="text-sm text-[var(--muted)]">
                    Add agents and employees to see their status here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Event stream - right sidebar */}
        <div className="overflow-hidden">
          <EventStream events={events} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </FadeIn>
  );
}