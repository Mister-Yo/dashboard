import { Hono } from "hono";
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "../db";
import { activityEvents, agents, employees } from "../db/schema";

const app = new Hono();

// GET /activity — list events (newest first), optional filters
app.get("/", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const actorId = c.req.query("actor_id");
  const eventType = c.req.query("event_type");
  const since = c.req.query("since");

  const conditions = [];
  if (actorId) conditions.push(eq(activityEvents.actorId, actorId));
  if (eventType)
    conditions.push(
      eq(activityEvents.eventType, eventType as typeof activityEvents.eventType.enumValues[number])
    );
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      conditions.push(gte(activityEvents.createdAt, sinceDate));
    }
  }

  const result = await db
    .select()
    .from(activityEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  return c.json(result);
});

// POST /activity — log a new event + optionally update work status
app.post("/", async (c) => {
  const body = await c.req.json();
  const {
    actor_type,
    actor_id,
    actor_name,
    event_type,
    title,
    description,
    project_id,
    task_id,
    metadata,
    work_status,
  } = body;

  if (!actor_type || !actor_id || !actor_name || !event_type || !title) {
    return c.json(
      { error: "actor_type, actor_id, actor_name, event_type, title required" },
      400
    );
  }

  const [event] = await db
    .insert(activityEvents)
    .values({
      actorType: actor_type,
      actorId: actor_id,
      actorName: actor_name,
      eventType: event_type,
      title,
      description: description ?? "",
      projectId: project_id ?? null,
      taskId: task_id ?? null,
      metadata: metadata ?? {},
    })
    .returning();

  // If work_status provided, update the actor's work status
  if (work_status) {
    if (actor_type === "agent") {
      await db
        .update(agents)
        .set({
          workStatus: work_status,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, actor_id))
        .catch(() => {});
    } else if (actor_type === "employee") {
      await db
        .update(employees)
        .set({
          workStatus: work_status,
          currentTaskDescription: title,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, actor_id))
        .catch(() => {});
    }
  }

  return c.json(event, 201);
});

// GET /activity/status — get work status of all agents + employees
app.get("/status", async (c) => {
  const allAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      type: agents.type,
      workStatus: agents.workStatus,
      currentTaskId: agents.currentTaskId,
      lastHeartbeat: agents.lastHeartbeat,
    })
    .from(agents);

  const allEmployees = await db
    .select({
      id: employees.id,
      name: employees.name,
      role: employees.role,
      workStatus: employees.workStatus,
      currentTaskDescription: employees.currentTaskDescription,
    })
    .from(employees);

  return c.json({
    agents: allAgents.map((a) => ({
      ...a,
      entityType: "agent" as const,
    })),
    employees: allEmployees.map((e) => ({
      ...e,
      entityType: "employee" as const,
    })),
  });
});

// PATCH /activity/status/:actorType/:actorId — update work status directly
app.patch("/status/:actorType/:actorId", async (c) => {
  const actorType = c.req.param("actorType");
  const actorId = c.req.param("actorId");
  const body = await c.req.json();
  const { work_status, current_task_description } = body;

  if (!work_status) {
    return c.json({ error: "work_status required" }, 400);
  }

  if (actorType === "agent") {
    const [updated] = await db
      .update(agents)
      .set({ workStatus: work_status, updatedAt: new Date() })
      .where(eq(agents.id, actorId))
      .returning();
    if (!updated) return c.json({ error: "Agent not found" }, 404);
    return c.json(updated);
  } else if (actorType === "employee") {
    const [updated] = await db
      .update(employees)
      .set({
        workStatus: work_status,
        currentTaskDescription: current_task_description ?? null,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, actorId))
      .returning();
    if (!updated) return c.json({ error: "Employee not found" }, 404);
    return c.json(updated);
  }

  return c.json({ error: "actorType must be agent or employee" }, 400);
});

export default app;
