import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { agents } from "../db/schema";
import { generateApiKey } from "../services/api-key";

const app = new Hono();

// List all agents
app.get("/", async (c) => {
  const result = await db.select().from(agents);
  return c.json(result);
});

// Get agent by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json(agent);
});

// Create agent + generate API key
app.post("/", async (c) => {
  const body = await c.req.json();
  const { name, type, permissions, metadata } = body;

  if (!name || !type) {
    return c.json({ error: "name and type are required" }, 400);
  }

  // Generate API key
  const tempId = crypto.randomUUID();
  const apiKeyResult = await generateApiKey("agent", tempId, permissions ?? []);

  const [agent] = await db
    .insert(agents)
    .values({
      id: tempId,
      name,
      type,
      apiKeyHash: "", // Will be set via the api_keys table
      apiKeyPrefix: apiKeyResult.prefix,
      permissions: permissions ?? [],
      metadata: metadata ?? {},
    })
    .returning();

  return c.json(
    {
      agent,
      apiKey: apiKeyResult.key, // Only shown once!
    },
    201
  );
});

// Update agent
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const [updated] = await db
    .update(agents)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(agents.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json(updated);
});

// Agent heartbeat
app.post("/:id/heartbeat", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const [updated] = await db
    .update(agents)
    .set({
      lastHeartbeat: new Date(),
      status: body.status ?? "active",
      currentTaskId: body.currentTaskId ?? undefined,
      currentProjectId: body.currentProjectId ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json({ ok: true });
});

// Delete agent
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [deleted] = await db
    .delete(agents)
    .where(eq(agents.id, id))
    .returning();

  if (!deleted) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json({ ok: true });
});

export default app;
