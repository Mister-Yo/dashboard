"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

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

const STATUS: Record<string, { color: string; bg: string; glow: string; label: string }> = {
  working: { color: "#34d399", bg: "rgba(34,211,153,0.12)", glow: "0 0 20px rgba(34,211,153,0.45)", label: "Working" },
  idle:    { color: "#64748b", bg: "rgba(100,116,139,0.1)", glow: "none", label: "Idle" },
  off:     { color: "#475569", bg: "rgba(71,85,105,0.1)", glow: "none", label: "Offline" },
  waiting: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", glow: "0 0 16px rgba(251,191,36,0.35)", label: "Waiting" },
};

const AVATARS: Record<string, { char: string; gradient: [string, string] }> = {
  CLAUDE: { char: "C", gradient: ["#8b5cf6", "#6d28d9"] },
  CODE:   { char: "X", gradient: ["#06b6d4", "#0891b2"] },
  QA:     { char: "Q", gradient: ["#f59e0b", "#d97706"] },
  CEO:    { char: "B", gradient: ["#f6c453", "#e5a91a"] },
};

const EVENT_ICONS: Record<string, string> = {
  start_task: "▶", finish_task: "✓", status_change: "⚡", note: "✎",
  blocker: "⛔", deploy: "🚀", commit: "●", review: "◉",
};

/* ─── Helpers ────────────────────────────────────────────── */

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/* ─── Office map layout — compact 16×10 ──────────────────── */

const T = 56; // tile size (bigger)
const GW = 16;
const GH = 10;

type Room = {
  id: string;
  label: string;
  icon: string;
  x: number; y: number; w: number; h: number;
  floor: string;   // floor fill
  wall: string;    // border color
  accent: string;  // label + glow color
};

const ROOMS: Room[] = [
  { id: "ceo",    label: "CEO Office",      icon: "👔", x: 0.5, y: 0.5, w: 4, h: 4, floor: "rgba(246,196,83,0.07)",  wall: "rgba(246,196,83,0.3)", accent: "#f6c453" },
  { id: "server", label: "AI Server Room",  icon: "🖥", x: 5.5, y: 0.5, w: 10, h: 4, floor: "rgba(139,92,246,0.07)", wall: "rgba(139,92,246,0.3)", accent: "#8b5cf6" },
  { id: "war",    label: "War Room",        icon: "⚔",  x: 0.5, y: 5.5, w: 6, h: 4, floor: "rgba(6,182,212,0.06)",   wall: "rgba(6,182,212,0.25)", accent: "#06b6d4" },
  { id: "lounge", label: "Lounge",          icon: "☕", x: 7.5, y: 5.5, w: 8, h: 4, floor: "rgba(34,197,94,0.05)",   wall: "rgba(34,197,94,0.2)",  accent: "#22c55e" },
];

// Desk positions
type Desk = { x: number; y: number; forRoom: string };
const AGENT_DESKS: Desk[] = [
  { x: 7.5, y: 2.2, forRoom: "server" },
  { x: 10,  y: 2.2, forRoom: "server" },
  { x: 12.5,y: 2.2, forRoom: "server" },
];
const PEOPLE_DESKS: Desk[] = [
  { x: 2.2, y: 2.2, forRoom: "ceo" },
];

// Decorative furniture
type Furn = { x: number; y: number; emoji: string; size?: number };
const FURN: Furn[] = [
  // CEO
  { x: 1, y: 1.2, emoji: "🗄️" }, { x: 3.5, y: 3.5, emoji: "📊" }, { x: 1, y: 3.5, emoji: "🪴", size: 18 },
  // Server Room — rack servers
  { x: 6.5, y: 1, emoji: "🖲️" }, { x: 9, y: 1, emoji: "📡", size: 18 }, { x: 11.5, y: 1, emoji: "🖲️" }, { x: 14, y: 1, emoji: "📡", size: 18 },
  { x: 14, y: 3.5, emoji: "🔧" }, { x: 6.5, y: 3.5, emoji: "⚙️" },
  // War Room
  { x: 2.5, y: 7, emoji: "📺", size: 20 }, { x: 1.2, y: 6.5, emoji: "🪑" }, { x: 3.8, y: 6.5, emoji: "🪑" },
  { x: 1.2, y: 8.5, emoji: "🪑" }, { x: 3.8, y: 8.5, emoji: "🪑" }, { x: 5.5, y: 8.5, emoji: "📌" },
  // Lounge
  { x: 8.5, y: 6.5, emoji: "🛋️", size: 20 }, { x: 10.5, y: 7.5, emoji: "☕", size: 18 },
  { x: 12, y: 6.5, emoji: "🎮" }, { x: 14, y: 8.5, emoji: "🪴", size: 18 }, { x: 8.5, y: 8.5, emoji: "📚" },
  // Hallway decorations
  { x: 4.8, y: 4.8, emoji: "🚪" }, { x: 6.5, y: 4.8, emoji: "🚪" }, { x: 6.8, y: 5.2, emoji: "🚪" },
];

/* ─── SVG Avatar Component ───────────────────────────────── */

function SvgAvatar({
  entity, desk, selected, onClick,
}: {
  entity: WorkEntity; desk: Desk; selected: boolean; onClick: () => void;
}) {
  const st = STATUS[entity.workStatus] ?? STATUS.idle;
  const key = entity.entityType === "agent" ? entity.name : (entity.role?.toUpperCase() ?? "CEO");
  const av = AVATARS[key] ?? { char: "?", gradient: ["#64748b", "#475569"] };
  const cx = desk.x * T + T / 2;
  const cy = desk.y * T + T / 2;
  const r = 22;
  const gradId = `av-${entity.id.slice(0, 8)}`;

  return (
    <g className="cursor-pointer" onClick={onClick}>
      {/* Desk surface */}
      <rect
        x={desk.x * T + 2} y={desk.y * T + 2}
        width={T - 4} height={T - 4}
        rx={10}
        fill="rgba(255,255,255,0.03)"
        stroke={selected ? st.color : "rgba(255,255,255,0.06)"}
        strokeWidth={selected ? 1.5 : 0.5}
      />

      {/* Working glow */}
      {entity.workStatus === "working" && (
        <>
          <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke={st.color} strokeWidth={1} opacity={0.15}>
            <animate attributeName="r" values={`${r + 6};${r + 12};${r + 6}`} dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={st.color} strokeWidth={0.8} opacity={0.3}>
            <animate attributeName="opacity" values="0.3;0.08;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Waiting pulse */}
      {entity.workStatus === "waiting" && (
        <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke={st.color} strokeWidth={1} opacity={0.2}>
          <animate attributeName="opacity" values="0.25;0.05;0.25" dur="1.8s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Avatar circle with gradient */}
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={av.gradient[0]} />
          <stop offset="100%" stopColor={av.gradient[1]} />
        </linearGradient>
      </defs>
      <circle
        cx={cx} cy={cy} r={r}
        fill={`url(#${gradId})`}
        stroke={selected ? "#fff" : `${av.gradient[0]}80`}
        strokeWidth={selected ? 2.5 : 1.5}
        style={{
          filter: selected ? `drop-shadow(0 0 12px ${av.gradient[0]})` : `drop-shadow(0 2px 4px rgba(0,0,0,0.4))`,
        }}
      />

      {/* Character letter */}
      <text
        x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="central"
        fontSize={18} fontWeight={700}
        fill="#fff"
        fontFamily="var(--font-sans), system-ui"
        style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
      >
        {av.char}
      </text>

      {/* Status dot */}
      <circle
        cx={cx + r - 2} cy={cy - r + 5} r={5}
        fill={st.color}
        stroke="rgba(11,15,20,0.95)"
        strokeWidth={2}
      >
        {(entity.workStatus === "working" || entity.workStatus === "waiting") && (
          <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Name tag */}
      <rect
        x={cx - 24} y={cy + r + 4}
        width={48} height={16}
        rx={6}
        fill="rgba(11,15,20,0.85)"
        stroke={`${st.color}40`}
        strokeWidth={0.5}
      />
      <text
        x={cx} y={cy + r + 13}
        textAnchor="middle" dominantBaseline="central"
        fontSize={9} fontWeight={600}
        fill={st.color}
        fontFamily="var(--font-sans), system-ui"
        style={{ pointerEvents: "none" }}
      >
        {entity.name}
      </text>
    </g>
  );
}

/* ─── Entity Panel (right sidebar) ───────────────────────── */

function EntityPanel({ entity, onClose }: { entity: WorkEntity; onClose: () => void }) {
  const st = STATUS[entity.workStatus] ?? STATUS.idle;
  const key = entity.entityType === "agent" ? entity.name : (entity.role?.toUpperCase() ?? "CEO");
  const av = AVATARS[key] ?? { char: "?", gradient: ["#64748b", "#475569"] };

  return (
    <div className="rounded-2xl border overflow-hidden shrink-0" style={{
      borderColor: `${st.color}25`,
      background: `linear-gradient(135deg, ${av.gradient[0]}08, var(--surface))`,
    }}>
      {/* Top accent bar */}
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${av.gradient[0]}, ${av.gradient[1]})` }} />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
              style={{ background: `linear-gradient(135deg, ${av.gradient[0]}, ${av.gradient[1]})` }}>
              {av.char}
            </div>
            <div>
              <p className="font-semibold text-sm">{entity.name}</p>
              <p className="text-[10px] text-[var(--muted)]">
                {entity.entityType === "agent" ? (entity.type ?? "agent").replace(/_/g, " ") : entity.role ?? "employee"}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] w-6 h-6 rounded-lg hover:bg-white/5 flex items-center justify-center transition-all text-xs">
            ✕
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: st.bg }}>
          <span className="h-2 w-2 rounded-full" style={{
            backgroundColor: st.color,
            boxShadow: entity.workStatus === "working" ? st.glow : "none",
          }} />
          <span className="text-[11px] font-semibold" style={{ color: st.color }}>{st.label}</span>
        </div>

        {/* Task */}
        {entity.currentTaskDescription && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3">
            <p className="text-[9px] text-[var(--muted)] mb-1 uppercase tracking-[0.15em] font-medium">Current Task</p>
            <p className="text-[11px] leading-relaxed line-clamp-3">{entity.currentTaskDescription}</p>
          </div>
        )}

        {entity.lastHeartbeat && (
          <p className="text-[10px] text-[var(--muted)] opacity-50">
            Last heartbeat {timeAgo(entity.lastHeartbeat)} ago
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Event Stream ───────────────────────────────────────── */

function EventStream({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-[var(--card-border)] flex items-center justify-between">
        <h3 className="text-[11px] font-semibold flex items-center gap-2 tracking-wide uppercase">
          <span className="opacity-60">📡</span> Event Stream
          {events.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </h3>
        <span className="text-[10px] text-[var(--muted)] tabular-nums">{events.length}</span>
      </div>
      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted)]">
            <p className="text-xs opacity-50">No events yet</p>
          </div>
        ) : (
          events.map((ev, i) => {
            const isAg = ev.actorType === "agent";
            const key = ev.actorName?.toUpperCase();
            const av = AVATARS[key] ?? (isAg ? AVATARS.CLAUDE : AVATARS.CEO);
            return (
              <div key={ev.id}
                className="px-3 py-2.5 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-0"
                style={{ animation: i === 0 ? "fadeIn 0.3s ease-out" : "none" }}>
                <div className="flex items-start gap-2.5">
                  {/* Mini avatar */}
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white mt-0.5 shrink-0"
                    style={{ background: `linear-gradient(135deg, ${av.gradient[0]}, ${av.gradient[1]})` }}>
                    {av.char}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold" style={{ color: av.gradient[0] }}>
                        {ev.actorName}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] opacity-40">{EVENT_ICONS[ev.eventType] ?? "●"}</span>
                        <span className="text-[9px] text-[var(--muted)] tabular-nums">{formatTime(ev.createdAt)}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--foreground)] leading-snug opacity-60 line-clamp-1 mt-0.5">
                      {ev.title}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function ActivityPage() {
  const [entities, setEntities] = useState<WorkEntity[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [st, ev] = await Promise.all([
        apiFetch<{ agents: WorkEntity[]; employees: WorkEntity[] }>("/api/activity/status"),
        apiFetch<ActivityEvent[]>("/api/activity?limit=50"),
      ]);
      setEntities([...st.agents, ...st.employees]);
      setEvents(ev);
    } catch (e) {
      console.error("Activity load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 10000);
    return () => clearInterval(t);
  }, [loadData]);

  const agents = useMemo(() => entities.filter(e => e.entityType === "agent"), [entities]);
  const employees = useMemo(() => entities.filter(e => e.entityType === "employee"), [entities]);
  const selected = useMemo(() => selectedId ? entities.find(e => e.id === selectedId) ?? null : null, [entities, selectedId]);

  const counts = useMemo(() => {
    const c = { working: 0, idle: 0, off: 0, waiting: 0 };
    entities.forEach(e => { if (e.workStatus in c) c[e.workStatus as keyof typeof c]++; });
    return c;
  }, [entities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🏢</div>
          <p className="text-[var(--muted)] text-sm animate-pulse">Loading office...</p>
        </div>
      </div>
    );
  }

  const svgW = GW * T;
  const svgH = GH * T;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] gap-3">
      {/* ── Header ────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">🏢 Office</h1>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["working", "waiting", "idle", "off"] as const).map(k => {
            const s = STATUS[k];
            if (!counts[k]) return null;
            return (
              <span key={k} className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border"
                style={{ color: s.color, borderColor: `${s.color}25`, backgroundColor: s.bg }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {counts[k]}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Main grid: Map left, sidebar right ────── */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

        {/* ── Office Map ────── */}
        <div className="flex-1 min-w-0 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] overflow-auto relative">
          {/* Legend overlay */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2.5 bg-[rgba(11,15,20,0.9)] backdrop-blur-sm rounded-xl px-3 py-1.5 border border-[var(--card-border)]">
            {[
              { c: "#34d399", l: "Active" },
              { c: "#fbbf24", l: "Waiting" },
              { c: "#64748b", l: "Idle" },
            ].map(({ c, l }) => (
              <div key={l} className="flex items-center gap-1">
                <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: c }} />
                <span className="text-[8px] text-[var(--muted)] font-medium">{l}</span>
              </div>
            ))}
          </div>

          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full" style={{ minHeight: 480, minWidth: 600 }}>
            {/* Background */}
            <defs>
              <pattern id="floor-grid" width={T} height={T} patternUnits="userSpaceOnUse">
                <rect width={T} height={T} fill="none" stroke="rgba(255,255,255,0.015)" strokeWidth={0.5} />
              </pattern>
              <pattern id="tile-pattern" width={T / 2} height={T / 2} patternUnits="userSpaceOnUse">
                <rect width={T / 2} height={T / 2} fill="none" stroke="rgba(255,255,255,0.008)" strokeWidth={0.3} />
              </pattern>
              {/* Room floor textures */}
              {ROOMS.map(room => (
                <pattern key={`pat-${room.id}`} id={`floor-${room.id}`} width={T / 3} height={T / 3} patternUnits="userSpaceOnUse">
                  <rect width={T / 3} height={T / 3} fill="none" stroke={room.wall} strokeWidth={0.15} opacity={0.3} />
                </pattern>
              ))}
            </defs>

            {/* Base floor */}
            <rect width={svgW} height={svgH} fill="var(--background)" />
            <rect width={svgW} height={svgH} fill="url(#floor-grid)" />

            {/* Hallway */}
            <rect x={4.6 * T} y={0} width={0.8 * T} height={svgH} fill="rgba(255,255,255,0.008)" />
            <rect x={0} y={4.6 * T} width={svgW} height={0.8 * T} fill="rgba(255,255,255,0.008)" />

            {/* Rooms */}
            {ROOMS.map(room => {
              const rx = room.x * T;
              const ry = room.y * T;
              const rw = room.w * T;
              const rh = room.h * T;
              return (
                <g key={room.id}>
                  {/* Floor fill */}
                  <rect x={rx} y={ry} width={rw} height={rh} rx={14} fill={room.floor} />
                  {/* Floor tile texture */}
                  <rect x={rx} y={ry} width={rw} height={rh} rx={14} fill={`url(#floor-${room.id})`} />
                  {/* Wall border */}
                  <rect x={rx} y={ry} width={rw} height={rh} rx={14}
                    fill="none" stroke={room.wall} strokeWidth={2} />
                  {/* Room name */}
                  <text x={rx + 14} y={ry + 20} fontSize={12} fontWeight={700}
                    fill={room.accent} opacity={0.5}
                    fontFamily="var(--font-sans), system-ui">{room.icon} {room.label}</text>
                </g>
              );
            })}

            {/* Furniture */}
            {FURN.map((f, i) => (
              <text key={`f-${i}`}
                x={f.x * T + T / 2} y={f.y * T + T / 2 + 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize={f.size ?? 16} opacity={0.65}
                style={{ pointerEvents: "none" }}>
                {f.emoji}
              </text>
            ))}

            {/* Network links between agents */}
            {agents.length >= 2 && agents.slice(1).map((_, i) => {
              const d0 = AGENT_DESKS[0];
              const d1 = AGENT_DESKS[(i + 1) % AGENT_DESKS.length];
              if (!d0 || !d1) return null;
              return (
                <line key={`net-${i}`}
                  x1={d0.x * T + T / 2} y1={d0.y * T + T / 2}
                  x2={d1.x * T + T / 2} y2={d1.y * T + T / 2}
                  stroke="rgba(139,92,246,0.15)" strokeWidth={1} strokeDasharray="4 3">
                  <animate attributeName="stroke-dashoffset" values="0;7" dur="2s" repeatCount="indefinite" />
                </line>
              );
            })}

            {/* Agents */}
            {agents.map((agent, i) => {
              const desk = AGENT_DESKS[i % AGENT_DESKS.length];
              if (!desk) return null;
              return (
                <SvgAvatar key={agent.id} entity={agent} desk={desk}
                  selected={selectedId === agent.id}
                  onClick={() => setSelectedId(selectedId === agent.id ? null : agent.id)} />
              );
            })}

            {/* People */}
            {employees.map((emp, i) => {
              const desk = PEOPLE_DESKS[i % PEOPLE_DESKS.length];
              if (!desk) return null;
              return (
                <SvgAvatar key={emp.id} entity={emp} desk={desk}
                  selected={selectedId === emp.id}
                  onClick={() => setSelectedId(selectedId === emp.id ? null : emp.id)} />
              );
            })}
          </svg>
        </div>

        {/* ── Right Sidebar (always visible) ────── */}
        <div className="w-[280px] shrink-0 flex flex-col gap-3 overflow-hidden">
          {/* Entity detail panel */}
          {selected && <EntityPanel entity={selected} onClose={() => setSelectedId(null)} />}

          {/* Roster */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] overflow-hidden shrink-0">
            <div className="px-3 py-2.5 border-b border-[var(--card-border)]">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide opacity-70">👥 Roster</h3>
            </div>
            <div className="p-1.5">
              {entities.map(e => {
                const s = STATUS[e.workStatus] ?? STATUS.idle;
                const key = e.entityType === "agent" ? e.name : (e.role?.toUpperCase() ?? "CEO");
                const av = AVATARS[key] ?? AVATARS.CEO;
                return (
                  <button key={e.id}
                    onClick={() => setSelectedId(selectedId === e.id ? null : e.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
                      selectedId === e.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, ${av.gradient[0]}, ${av.gradient[1]})` }}>
                      {av.char}
                    </div>
                    <span className="text-xs font-medium flex-1 truncate">{e.name}</span>
                    <span className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.color, boxShadow: e.workStatus === "working" ? s.glow : "none" }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event stream */}
          <div className="flex-1 overflow-hidden min-h-0">
            <EventStream events={events} />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
