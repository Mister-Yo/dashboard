"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────── */

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  workStatus: string;
  currentProjectId: string | null;
  permissions: string[];
  managerId: string | null;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  email: string | null;
  status: string;
  workStatus: string;
  assignedProjectIds: string[];
  managerId: string | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

/* ─── Unified org node ──────────────────────────────────── */

interface OrgNode {
  id: string;
  name: string;
  role: string;
  kind: "employee" | "agent";
  status: string;
  workStatus: string;
  managerId: string | null;
  avatar: { char: string; gradient: [string, string] };
  children: OrgNode[];
  projectName?: string;
  permissions?: string[];
  email?: string;
}

/* ─── Config ────────────────────────────────────────────── */

const AVATARS: Record<string, { char: string; gradient: [string, string] }> = {
  CEO:    { char: "B", gradient: ["#f6c453", "#e5a91a"] },
  CLAUDE: { char: "C", gradient: ["#8b5cf6", "#6d28d9"] },
  CODE:   { char: "X", gradient: ["#06b6d4", "#0891b2"] },
  QA:     { char: "Q", gradient: ["#f59e0b", "#d97706"] },
};

const STATUS_COLORS: Record<string, string> = {
  working: "#34d399", idle: "#64748b", off: "#475569",
  waiting: "#fbbf24", active: "#34d399",
};

const ROLE_LABELS: Record<string, string> = {
  ceo: "Chief Executive Officer",
  claude_code: "Backend & DevOps",
  codex: "Frontend Engineer",
  qa: "QA Engineer",
};

/* ─── Tree layout ───────────────────────────────────────── */

const CARD_W = 200;
const CARD_H = 88;
const GAP_X = 40;
const GAP_Y = 70;
const PAD = 30;

interface LayoutNode {
  node: OrgNode;
  x: number;
  y: number;
  width: number;
  children: LayoutNode[];
}

function layoutTree(node: OrgNode, depth: number): LayoutNode {
  if (node.children.length === 0) {
    return { node, x: 0, y: depth * (CARD_H + GAP_Y), width: CARD_W, children: [] };
  }

  const childLayouts = node.children.map((c) => layoutTree(c, depth + 1));
  const totalWidth = childLayouts.reduce((s, c) => s + c.width, 0) + (childLayouts.length - 1) * GAP_X;
  const width = Math.max(totalWidth, CARD_W);

  return {
    node,
    x: width / 2 - CARD_W / 2,
    y: depth * (CARD_H + GAP_Y),
    width,
    children: childLayouts,
  };
}

/* ─── SVG Card ──────────────────────────────────────────── */

function OrgCard({
  node, x, y, selected, onClick,
}: {
  node: OrgNode; x: number; y: number; selected: boolean; onClick: () => void;
}) {
  const statusColor = STATUS_COLORS[node.workStatus] ?? STATUS_COLORS[node.status] ?? "#64748b";
  const gradId = `g-${node.id.slice(0, 8)}`;

  return (
    <g className="cursor-pointer" onClick={onClick}>
      <rect x={x} y={y} width={CARD_W} height={CARD_H} rx={14}
        fill="var(--card)" stroke={selected ? node.avatar.gradient[0] : "var(--card-border)"}
        strokeWidth={selected ? 2 : 1}
        style={{ filter: selected ? `drop-shadow(0 0 10px ${node.avatar.gradient[0]}40)` : "drop-shadow(0 2px 6px rgba(0,0,0,.3))" }}
      />
      <rect x={x} y={y} width={CARD_W} height={3} rx={1.5} fill={`url(#${gradId})`}
        clipPath="inset(0 0 0 0 round 14px 14px 0 0)"
      />
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={node.avatar.gradient[0]} />
          <stop offset="100%" stopColor={node.avatar.gradient[1]} />
        </linearGradient>
      </defs>
      {/* Avatar */}
      <circle cx={x + 28} cy={y + 42} r={17} fill={`url(#${gradId})`} />
      <text x={x + 28} y={y + 43} textAnchor="middle" dominantBaseline="central"
        fontSize={12} fontWeight={700} fill="#fff" style={{ pointerEvents: "none" }}>
        {node.avatar.char}
      </text>
      {/* Status dot */}
      <circle cx={x + 40} cy={y + 30} r={4} fill={statusColor} stroke="var(--card)" strokeWidth={1.5}>
        {(node.workStatus === "working" || node.status === "active") && (
          <animate attributeName="opacity" values="1;.4;1" dur="2s" repeatCount="indefinite" />
        )}
      </circle>
      {/* Name */}
      <text x={x + 54} y={y + 34} fontSize={12} fontWeight={600} fill="var(--foreground)" style={{ pointerEvents: "none" }}>
        {node.name}
      </text>
      {/* Role */}
      <text x={x + 54} y={y + 50} fontSize={9} fill="var(--muted)" style={{ pointerEvents: "none" }}>
        {node.role.length > 22 ? node.role.slice(0, 21) + "\u2026" : node.role}
      </text>
      {/* Badge */}
      <rect x={x + 54} y={y + 58} width={node.kind === "agent" ? 38 : 52} height={14} rx={5}
        fill={node.kind === "agent" ? "rgba(139,92,246,.15)" : "rgba(246,196,83,.15)"}
      />
      <text x={x + 54 + (node.kind === "agent" ? 19 : 26)} y={y + 66} textAnchor="middle" dominantBaseline="central"
        fontSize={7} fontWeight={600} fill={node.kind === "agent" ? "#8b5cf6" : "#f6c453"} style={{ pointerEvents: "none" }}>
        {node.kind === "agent" ? "AGENT" : "EMPLOYEE"}
      </text>
    </g>
  );
}

/* ─── Detail Panel ──────────────────────────────────────── */

function DetailPanel({
  node, allNodes, onClose, onChangeManager,
}: {
  node: OrgNode;
  allNodes: OrgNode[];
  onClose: () => void;
  onChangeManager: (nodeId: string, kind: "employee" | "agent", newManagerId: string | null) => void;
}) {
  const statusColor = STATUS_COLORS[node.workStatus] ?? "#64748b";
  const manager = allNodes.find((n) => n.id === node.managerId);

  // Prevent circular: collect all descendants
  const descendants = new Set<string>();
  function collectDesc(id: string) {
    for (const n of allNodes) {
      if (n.managerId === id) { descendants.add(n.id); collectDesc(n.id); }
    }
  }
  collectDesc(node.id);

  const managerOptions = allNodes.filter((n) => n.id !== node.id && !descendants.has(n.id));

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${node.avatar.gradient[0]}25`, background: `linear-gradient(135deg, ${node.avatar.gradient[0]}08, var(--surface))` }}>
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${node.avatar.gradient[0]}, ${node.avatar.gradient[1]})` }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${node.avatar.gradient[0]}, ${node.avatar.gradient[1]})` }}>
              {node.avatar.char}
            </div>
            <div>
              <p className="font-semibold text-sm">{node.name}</p>
              <p className="text-[10px] text-[var(--muted)]">{node.role}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] w-6 h-6 rounded-lg hover:bg-white/5 flex items-center justify-center text-xs">
            &#10005;
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: `${statusColor}15` }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
          <span className="text-[11px] font-semibold capitalize" style={{ color: statusColor }}>
            {node.workStatus || node.status}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Type</span>
            <span className="capitalize">{node.kind}</span>
          </div>
          {node.email && (
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Email</span>
              <span>{node.email}</span>
            </div>
          )}
          {node.projectName && (
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Project</span>
              <span className="text-emerald-400">{node.projectName}</span>
            </div>
          )}

          {/* Reports to dropdown */}
          <div className="pt-2 border-t border-[var(--card-border)]">
            <label className="text-[var(--muted)] text-[10px] uppercase tracking-wide">Reports to</label>
            <select
              value={node.managerId ?? "__none__"}
              onChange={(e) => {
                const val = e.target.value === "__none__" ? null : e.target.value;
                onChangeManager(node.id, node.kind, val);
              }}
              className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface)] text-xs px-2 py-1.5 text-[var(--foreground)]"
            >
              <option value="__none__">-- None (root) --</option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.kind === "agent" ? "Agent" : m.role})
                </option>
              ))}
            </select>
            {manager && (
              <p className="text-[10px] text-[var(--muted)] mt-1">
                Currently: {manager.name}
              </p>
            )}
          </div>

          {/* Direct reports */}
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Direct reports</span>
            <span>{node.children.length > 0 ? node.children.map((c) => c.name).join(", ") : "\u2014"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Roster tree item ──────────────────────────────────── */

function RosterNode({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <>
      <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
        {depth > 0 && <span className="text-[var(--card-border)]">&#x2514;</span>}
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${node.avatar.gradient[0]}, ${node.avatar.gradient[1]})` }}
        >
          {node.avatar.char}
        </div>
        <span className="font-medium">{node.name}</span>
        <span className="text-[var(--muted)] text-[10px] truncate">{node.kind === "agent" ? "Agent" : node.role}</span>
      </div>
      {node.children.map((child) => (
        <RosterNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

/* ─── Page ──────────────────────────────────────────────── */

export default function StructurePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [a, e, p] = await Promise.all([
        apiFetch<Agent[]>("/api/agents"),
        apiFetch<Employee[]>("/api/employees"),
        apiFetch<Project[]>("/api/projects"),
      ]);
      setAgents(a);
      setEmployees(e);
      setProjects(p);
    } catch (err) {
      console.error("Failed to load structure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [projects]);

  // Build flat list of all org nodes
  const allNodes = useMemo((): OrgNode[] => {
    const empNodes: OrgNode[] = employees
      .filter((e) => e.status !== "inactive")
      .map((e) => ({
        id: e.id, name: e.name,
        role: ROLE_LABELS[e.role] ?? e.role,
        kind: "employee" as const,
        status: e.status, workStatus: e.workStatus,
        managerId: e.managerId,
        avatar: AVATARS[e.role.toUpperCase()] ?? { char: e.name[0]?.toUpperCase() ?? "?", gradient: ["#64748b", "#475569"] as [string, string] },
        children: [],
        email: e.email ?? undefined,
        projectName: e.assignedProjectIds?.length ? projectMap.get(e.assignedProjectIds[0]) : undefined,
      }));

    const agentNodes: OrgNode[] = agents.map((a) => ({
      id: a.id, name: a.name,
      role: ROLE_LABELS[a.type] ?? a.type,
      kind: "agent" as const,
      status: a.status, workStatus: a.workStatus,
      managerId: a.managerId,
      avatar: AVATARS[a.name.toUpperCase()] ?? { char: a.name[0]?.toUpperCase() ?? "?", gradient: ["#64748b", "#475569"] as [string, string] },
      children: [],
      projectName: a.currentProjectId ? projectMap.get(a.currentProjectId) : undefined,
      permissions: a.permissions,
    }));

    return [...empNodes, ...agentNodes];
  }, [agents, employees, projectMap]);

  // Build tree from managerId
  const roots = useMemo((): OrgNode[] => {
    const nodeMap = new Map<string, OrgNode>();
    const nodes = allNodes.map((n) => ({ ...n, children: [] as OrgNode[] }));
    nodes.forEach((n) => nodeMap.set(n.id, n));

    const rootNodes: OrgNode[] = [];
    for (const n of nodes) {
      if (n.managerId && nodeMap.has(n.managerId)) {
        nodeMap.get(n.managerId)!.children.push(n);
      } else {
        rootNodes.push(n);
      }
    }
    return rootNodes;
  }, [allNodes]);

  const selectedNode = useMemo((): OrgNode | null => {
    if (!selectedId) return null;
    function find(nodes: OrgNode[]): OrgNode | null {
      for (const n of nodes) {
        if (n.id === selectedId) return n;
        const f = find(n.children);
        if (f) return f;
      }
      return null;
    }
    return find(roots);
  }, [selectedId, roots]);

  async function handleChangeManager(nodeId: string, kind: "employee" | "agent", newManagerId: string | null) {
    const endpoint = kind === "agent" ? `/api/agents/${nodeId}` : `/api/employees/${nodeId}`;
    try {
      await apiFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ managerId: newManagerId }),
      });
      await loadData();
    } catch (err) {
      console.error("Failed to update manager:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">&#127963;</div>
          <p className="text-[var(--muted)] text-sm">Loading structure...</p>
        </div>
      </div>
    );
  }

  // Layout all root trees side by side
  let totalSvgW = 0;
  let maxSvgH = 0;
  const treeLayouts: { layout: LayoutNode; offsetX: number }[] = [];

  for (const root of roots) {
    const lt = layoutTree(root, 0);
    treeLayouts.push({ layout: lt, offsetX: totalSvgW + PAD });
    totalSvgW += lt.width + PAD * 2;
    const md = (function gd(n: LayoutNode): number {
      return n.children.length === 0 ? 0 : 1 + Math.max(...n.children.map(gd));
    })(lt);
    maxSvgH = Math.max(maxSvgH, (md + 1) * (CARD_H + GAP_Y) + PAD * 2);
  }
  totalSvgW = Math.max(totalSvgW, 500);
  maxSvgH = Math.max(maxSvgH, 300);

  // Collect cards & edges
  const cards: { node: OrgNode; x: number; y: number }[] = [];
  const edges: { fromX: number; fromY: number; toX: number; toY: number }[] = [];

  function collect(ln: LayoutNode, parentOffX: number, parentWidth: number) {
    const myX = parentOffX + ln.x;
    const myY = ln.y + PAD;
    cards.push({ node: ln.node, x: myX, y: myY });

    const childrenW = ln.children.reduce((s, c) => s + c.width, 0) + Math.max(0, ln.children.length - 1) * GAP_X;
    let cx = parentOffX + (ln.width - childrenW) / 2;

    for (const child of ln.children) {
      const childX = cx + child.x;
      const childY = child.y + PAD;
      const midY = myY + CARD_H + (GAP_Y - CARD_H) / 2 + CARD_H / 2 - 5;
      edges.push({
        fromX: myX + CARD_W / 2, fromY: myY + CARD_H,
        toX: childX + CARD_W / 2, toY: childY,
      });
      collect(child, cx, child.width);
      cx += child.width + GAP_X;
    }
  }

  for (const { layout, offsetX } of treeLayouts) {
    collect(layout, offsetX, layout.width);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Organization</p>
          <h1 className="text-2xl font-bold">Company Structure</h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            {employees.length} people &middot; {agents.length} agents &middot; Click card to edit reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border border-amber-400/20 text-amber-400 bg-amber-400/10">
            &#128100; {employees.length}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border border-violet-400/20 text-violet-400 bg-violet-400/10">
            &#129302; {agents.length}
          </span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0">
        {/* SVG Chart */}
        <div className="flex-1 min-w-0 rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] overflow-auto">
          <svg viewBox={`0 0 ${totalSvgW} ${maxSvgH}`} className="w-full h-full" style={{ minHeight: 320, minWidth: 500 }}>
            <rect width={totalSvgW} height={maxSvgH} fill="var(--surface)" />
            {/* Edges */}
            {edges.map((e, i) => {
              const midY = (e.fromY + e.toY) / 2;
              return (
                <g key={`e${i}`}>
                  <line x1={e.fromX} y1={e.fromY} x2={e.fromX} y2={midY} stroke="var(--card-border)" strokeWidth={2} />
                  <line x1={e.fromX} y1={midY} x2={e.toX} y2={midY} stroke="var(--card-border)" strokeWidth={2} />
                  <line x1={e.toX} y1={midY} x2={e.toX} y2={e.toY} stroke="var(--card-border)" strokeWidth={2} />
                  <polygon points={`${e.toX - 3},${e.toY - 5} ${e.toX + 3},${e.toY - 5} ${e.toX},${e.toY}`} fill="var(--card-border)" />
                </g>
              );
            })}
            {/* Cards */}
            {cards.map((c) => (
              <OrgCard key={c.node.id} node={c.node} x={c.x} y={c.y}
                selected={selectedId === c.node.id}
                onClick={() => setSelectedId(selectedId === c.node.id ? null : c.node.id)}
              />
            ))}
          </svg>
        </div>

        {/* Sidebar */}
        <div className="w-[280px] shrink-0 flex flex-col gap-3 overflow-auto">
          {selectedNode ? (
            <DetailPanel node={selectedNode} allNodes={allNodes}
              onClose={() => setSelectedId(null)}
              onChangeManager={handleChangeManager}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4 text-center">
              <p className="text-3xl mb-2 opacity-30">&#127963;</p>
              <p className="text-xs text-[var(--muted)]">Click a card to edit reporting</p>
            </div>
          )}

          {/* Hierarchy roster */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] overflow-hidden">
            <div className="px-3 py-2.5 border-b border-[var(--card-border)]">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Hierarchy</h3>
            </div>
            <div className="p-3 text-xs space-y-1">
              {roots.map((root) => (
                <RosterNode key={root.id} node={root} depth={0} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
