import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./lib/logger";
import { HTTPException } from "hono/http-exception";
import agentsRouter from "./routes/agents";
import employeesRouter from "./routes/employees";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import knowledgeRouter from "./routes/knowledge";
import activityRouter from "./routes/activity";
import evaluationsRouter from "./routes/evaluations";
import sseRouter from "./routes/sse";
import queueRouter from "./routes/queue";
import coordinatorRouter from "./routes/coordinator";
import authRouter from "./routes/auth";
import analyticsRouter from "./routes/analytics";
import githubRouter from "./routes/github";
import { apiKeyAuth } from "./middleware/api-key";
import { jwtAuth } from "./middleware/jwt-auth";
import { rateLimit } from "./middleware/rate-limit";
import { activityLogger } from "./middleware/activity-logger";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = new Hono();

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://134.209.162.250:3002",
  "http://134.209.162.250",
  process.env.DASHBOARD_URL,
].filter(Boolean) as string[];

// Middleware
app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return ALLOWED_ORIGINS[0]; // non-browser requests
      return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    },
    credentials: true,
  })
);

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  logger.error({ err, method: c.req.method, path: c.req.path }, "Unhandled API error");
  return c.json(
    { error: "Internal server error", message: process.env.NODE_ENV === "development" ? err.message : undefined },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found", path: c.req.path }, 404);
});

// Rate limiting — 120 requests per minute for general API
app.use("/api/*", rateLimit({ windowMs: 60_000, max: 120 }));

// Stricter rate limit for auth endpoints — 30 per minute
app.use("/api/employees/login", rateLimit({ windowMs: 60_000, max: 30 }));
app.use("/api/employees/register", rateLimit({ windowMs: 60_000, max: 30 }));

// API Key auth — optional (sets apiKeyOwner if key provided, allows through if not)
// For strict auth, use requireAuth middleware on specific routes
app.use("/api/*", apiKeyAuth);

// JWT auth — optional (sets jwtUser if valid JWT provided)
app.use("/api/*", jwtAuth);

// Auto-logging — records activity events for mutations (fire-and-forget)
app.use("/api/*", activityLogger);

// Require auth for dangerous mutations (DELETE on all resources)
import { requireAuth } from "./middleware/api-key";
app.use("/api/*", async (c, next) => {
  if (c.req.method === "DELETE") return requireAuth(c, next);
  await next();
});

// Health check (basic — fast, for load balancers)
app.get("/", (c) => {
  return c.json({
    name: "AI Company Dashboard API",
    version: "0.1.0",
    status: "ok",
    endpoints: {
      agents: "/api/agents",
      employees: "/api/employees",
      projects: "/api/projects",
      tasks: "/api/tasks",
      knowledge: "/api/knowledge",
      activity: "/api/activity",
      activityStatus: "/api/activity/status",
      evaluations: "/api/evaluations",
      auth: "/api/auth/github",
      analytics: "/api/analytics/summary",
      github: "/api/github/webhooks",
    },
    timestamp: new Date().toISOString(),
  });
});

// Deep health check — verifies DB + Redis + queue
app.get("/health", async (c) => {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    let queue = null;
    try {
      const { getQueueStats } = await import("./services/queue");
      queue = await getQueueStats();
    } catch {}
    return c.json({
      status: "ok",
      db: "connected",
      queue,
      latencyMs: Date.now() - start,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage.rss() / 1024 / 1024) + "MB",
    });
  } catch (err) {
    return c.json(
      { status: "error", db: "disconnected", error: err instanceof Error ? err.message : "unknown" },
      503
    );
  }
});

// Routes
app.route("/api/agents", agentsRouter);
app.route("/api/employees", employeesRouter);
app.route("/api/projects", projectsRouter);
app.route("/api/tasks", tasksRouter);
app.route("/api/knowledge", knowledgeRouter);
app.route("/api/activity", activityRouter);
app.route("/api/evaluations", evaluationsRouter);
app.route("/api/sse", sseRouter);
app.route("/api/queue", queueRouter);
app.route("/api/coord", coordinatorRouter);
app.route("/api/auth", authRouter);
app.route("/api/analytics", analyticsRouter);
app.route("/api/github", githubRouter);

// Start server
const port = parseInt(process.env.API_PORT ?? "3001", 10);

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down gracefully...");
  try {
    const { closeQueue } = await import("./services/queue");
    await closeQueue();
  } catch {}
  setTimeout(() => process.exit(0), 2000);
};
process.on("SIGTERM", () => shutdown());
process.on("SIGINT", () => shutdown());

export default {
  port,
  fetch: app.fetch,
};

logger.info({ port, endpoints: ["agents", "employees", "projects", "tasks", "knowledge", "activity", "evaluations"] }, `Dashboard API running on http://0.0.0.0:${port}`);
