import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import { tasks } from "../db/schema";
import { isValidUuid } from "../lib/utils";
import { broadcast } from "./sse";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assigneeType: z.enum(["agent", "employee", "ceo"]),
  assigneeId: z.string().min(1),
  delegatedBy: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  dueDate: z.string().datetime().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const updateTaskSchema = createTaskSchema
  .extend({
    status: z.enum(["pending", "in_progress", "review", "completed", "blocked"]).optional(),
  })
  .partial();

const app = new Hono();

// List all tasks (with optional filters)
app.get("/", async (c) => {
  const projectId = c.req.query("projectId");
  const status = c.req.query("status");
  const assigneeId = c.req.query("assigneeId");

  let query = db.select().from(tasks);

  // Apply filters via where clauses
  const conditions = [];
  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  const validStatuses = ["pending", "in_progress", "review", "completed", "blocked"] as const;
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    conditions.push(eq(tasks.status, status as typeof validStatuses[number]));
  }
  if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));

  const result =
    conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

  return c.json(result);
});

// Get task by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid task ID format" }, 400);
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});

// Create task
app.post("/", zValidator("json", createTaskSchema), async (c) => {
  const {
    title,
    description,
    projectId,
    assigneeType,
    assigneeId,
    delegatedBy,
    priority,
    dueDate,
    parentTaskId,
    tags,
  } = c.req.valid("json");

  const [task] = await db
    .insert(tasks)
    .values({
      title,
      description: description ?? "",
      projectId: projectId ?? null,
      assigneeType,
      assigneeId,
      delegatedBy,
      priority: priority ?? "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      parentTaskId: parentTaskId ?? null,
      tags: tags ?? [],
    })
    .returning();

  broadcast({ type: "task:created", data: task, timestamp: new Date().toISOString() });
  return c.json(task, 201);
});

// Update task
app.patch("/:id", zValidator("json", updateTaskSchema), async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid task ID format" }, 400);
  const body = c.req.valid("json");

  // Handle status transitions
  const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };

  if (body.status === "completed") {
    updateData.completedAt = new Date();
  }

  if (body.dueDate) {
    updateData.dueDate = new Date(body.dueDate);
  }

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Task not found" }, 404);
  }

  broadcast({ type: "task:updated", data: updated, timestamp: new Date().toISOString() });
  return c.json(updated);
});

// Delete task
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid task ID format" }, 400);
  const [deleted] = await db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .returning();

  if (!deleted) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ ok: true });
});

export default app;
