import { createMiddleware } from "hono/factory";
import { db } from "../db";
import { activityEvents, agents, employees } from "../db/schema";
import { eq } from "drizzle-orm";
import { broadcast } from "../routes/sse";
import { logger } from "../lib/logger";
import type { ApiKeyOwner } from "./api-key";

// ─── Route Map ─────────────────────────────────────────

interface ActivityRouteConfig {
  method: string;
  path: string;
  eventType: "start_task" | "finish_task" | "status_change" | "note" | "blocker" | "deploy" | "commit" | "review";
  title: (body: Record<string, unknown>) => string;
}

const ACTIVITY_ROUTES: ActivityRouteConfig[] = [
  // Tasks
  { method: "POST", path: "/api/tasks", eventType: "start_task", title: (b) => `Task created: ${b.title ?? "untitled"}` },
  { method: "PATCH", path: "/api/tasks/:id", eventType: "status_change", title: (b) => b.status ? `Task status → ${b.status}` : "Task updated" },
  { method: "DELETE", path: "/api/tasks/:id", eventType: "status_change", title: () => "Task deleted" },

  // Projects
  { method: "POST", path: "/api/projects", eventType: "note", title: (b) => `Project created: ${b.name ?? "untitled"}` },
  { method: "PATCH", path: "/api/projects/:id", eventType: "status_change", title: (b) => b.status ? `Project status → ${b.status}` : "Project updated" },
  { method: "DELETE", path: "/api/projects/:id", eventType: "status_change", title: () => "Project deleted" },

  // Knowledge
  { method: "POST", path: "/api/knowledge", eventType: "note", title: (b) => `Knowledge added: ${b.title ?? "untitled"}` },
  { method: "POST", path: "/api/knowledge/ingest", eventType: "note", title: (b) => `URL ingested: ${b.url ?? "unknown"}` },
  { method: "DELETE", path: "/api/knowledge/:id", eventType: "status_change", title: () => "Knowledge entry deleted" },

  // Agents
  { method: "POST", path: "/api/agents", eventType: "note", title: (b) => `Agent created: ${b.name ?? "untitled"}` },
  { method: "DELETE", path: "/api/agents/:id", eventType: "status_change", title: () => "Agent deleted" },

  // Employees
  { method: "POST", path: "/api/employees/:id/approve", eventType: "status_change", title: () => "Employee approved" },
  { method: "POST", path: "/api/employees/:id/reject", eventType: "status_change", title: () => "Employee rejected" },

  // Evaluations
  { method: "POST", path: "/api/evaluations/generate", eventType: "review", title: () => "AI evaluation generated" },

  // Project sub-resources
  { method: "POST", path: "/api/projects/:id/blockers", eventType: "blocker", title: (b) => `Blocker: ${String(b.description ?? "").slice(0, 50)}` },
  { method: "PATCH", path: "/api/projects/:id/blockers/:blockerId/resolve", eventType: "status_change", title: () => "Blocker resolved" },
  { method: "POST", path: "/api/projects/:id/achievements", eventType: "note", title: (b) => `Achievement: ${String(b.description ?? "").slice(0, 50)}` },
  { method: "POST", path: "/api/projects/:id/members", eventType: "note", title: () => "Member added to project" },
  { method: "DELETE", path: "/api/projects/:id/members/:memberId", eventType: "note", title: () => "Member removed from project" },

  // Strategy
  { method: "POST", path: "/api/projects/:id/strategy-changes", eventType: "note", title: (b) => `Strategy change: ${String(b.summary ?? "").slice(0, 50)}` },

  // Coordinator
  { method: "POST", path: "/api/coord", eventType: "note", title: (b) => `Thread created: ${b.title ?? "untitled"}` },
  { method: "POST", path: "/api/coord/messages", eventType: "note", title: () => "Coordination message sent" },
];

// Build lookup map for fast matching
const routeMap = new Map<string, ActivityRouteConfig>();
for (const route of ACTIVITY_ROUTES) {
  routeMap.set(`${route.method}:${route.path}`, route);
}

// ─── Name cache (avoid repeated DB lookups) ────────────

const nameCache = new Map<string, { name: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function resolveActorName(owner: ApiKeyOwner): Promise<string> {
  const cacheKey = `${owner.type}:${owner.id}`;
  const cached = nameCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.name;

  try {
    let name = "Unknown";
    if (owner.type === "agent") {
      const [a] = await db.select({ name: agents.name }).from(agents).where(eq(agents.id, owner.id));
      if (a) name = a.name;
    } else {
      const [e] = await db.select({ name: employees.name }).from(employees).where(eq(employees.id, owner.id));
      if (e) name = e.name;
    }
    nameCache.set(cacheKey, { name, ts: Date.now() });
    return name;
  } catch {
    return "Unknown";
  }
}

// ─── Middleware ─────────────────────────────────────────

export const activityLogger = createMiddleware(async (c, next) => {
  const method = c.req.method;

  // Skip GET requests entirely
  if (method === "GET") {
    await next();
    return;
  }

  // Read body before handler consumes it
  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json();
    // Hono caches parsed JSON, so handler will still get it
  } catch {
    // Not JSON body — ok
  }

  await next();

  // After handler: check if we should log
  const status = c.res.status;
  if (status < 200 || status >= 300) return; // Only log successful mutations

  // Get the matched route pattern from Hono
  const routePath = c.req.routePath;
  if (!routePath) return;

  const config = routeMap.get(`${method}:${routePath}`);
  if (!config) return;

  // Resolve actor
  const owner = c.get("apiKeyOwner");
  const actorType = owner?.type ?? "ceo";
  const actorId = owner?.id ?? "system";
  const actorName = owner ? await resolveActorName(owner) : "CEO";

  // Fire-and-forget: insert activity event + broadcast
  const title = config.title(body);
  db.insert(activityEvents)
    .values({
      actorType: actorType as "agent" | "employee" | "ceo",
      actorId,
      actorName,
      eventType: config.eventType,
      title,
      description: "",
      metadata: { route: routePath, method },
    })
    .then(() => {
      broadcast({
        type: "activity:logged",
        data: { actorName, eventType: config.eventType, title },
        timestamp: new Date().toISOString(),
      });
    })
    .catch((err) => {
      logger.warn({ err, route: routePath }, "Activity auto-logging failed");
    });
});
