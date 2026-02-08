import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import agentsRouter from "./routes/agents";
import employeesRouter from "./routes/employees";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import knowledgeRouter from "./routes/knowledge";

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

// Health check
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
    },
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.route("/api/agents", agentsRouter);
app.route("/api/employees", employeesRouter);
app.route("/api/projects", projectsRouter);
app.route("/api/tasks", tasksRouter);
app.route("/api/knowledge", knowledgeRouter);

// Start server
const port = parseInt(process.env.API_PORT ?? "3001", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`🚀 Dashboard API running on http://0.0.0.0:${port}`);
console.log(`📊 Endpoints: agents, employees, projects, tasks, knowledge`);
