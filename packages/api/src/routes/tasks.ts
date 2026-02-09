import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db";
import { tasks } from "../db/schema";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string): boolean { return UUID_RE.test(id); }

// List all tasks (with optional filters)
app.get("/", async (c) => {
  const projectId = c.req.query("projectId");
  const status = c.req.query("status");
  const assigneeId = c.req.query("assigneeId");

  let query = db.select().from(tasks);

  // Apply filters via where clauses
  const conditions = [];
  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (status) conditions.push(eq(tasks.status, status as any));
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
app.post("/", async (c) => {
  const body = await c.req.json();
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
  } = body;

  if (!title || !assigneeType || !assigneeId || !delegatedBy) {
    return c.json(
      { error: "title, assigneeType, assigneeId, and delegatedBy are required" },
      400
    );
  }

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

  return c.json(task, 201);
});

// Update task
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid task ID format" }, 400);
  const body = await c.req.json();

  // Handle status transitions
  const updateData: Record<string, any> = { ...body, updatedAt: new Date() };

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
