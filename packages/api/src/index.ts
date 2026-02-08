import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import agentsRouter from "./routes/agents";
import employeesRouter from "./routes/employees";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import knowledgeRouter from "./routes/knowledge";
import activityRouter from "./routes/activity";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    credentials: true,
  })
);

function healthPayload() {
  return {
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
    },
    timestamp: new Date().toISOString(),
  };
}

// Health check
app.get("/", (c) => {
  return c.json(healthPayload());
});

// Nginx usually proxies /api/* without rewrite; expose health on that path too.
app.get("/api", (c) => c.json(healthPayload()));
app.get("/api/", (c) => c.json(healthPayload()));
app.get("/api/health", (c) => c.json(healthPayload()));

// Routes
app.route("/api/agents", agentsRouter);
app.route("/api/employees", employeesRouter);
app.route("/api/projects", projectsRouter);
app.route("/api/tasks", tasksRouter);
app.route("/api/knowledge", knowledgeRouter);
app.route("/api/activity", activityRouter);

// Start server
const port = parseInt(process.env.API_PORT ?? "3001", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`🚀 Dashboard API running on http://0.0.0.0:${port}`);
console.log(`📊 Endpoints: agents, employees, projects, tasks, knowledge, activity`);
