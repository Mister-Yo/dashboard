import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import { agents, employees } from "../db/schema";
import { generateApiKey } from "../services/api-key";
import { isValidUuid } from "../lib/utils";
import { broadcast } from "./sse";

const createAgentSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional().default("custom"),
  permissions: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateAgentSchema = createAgentSchema
  .extend({
    managerId: z.string().uuid().nullable().optional(),
    status: z.string().optional(),
  })
  .partial();

const app = new Hono();

/** Walk the manager chain and detect cycles */
async function wouldCreateCycle(
  entityId: string,
  newManagerId: string | null
): Promise<boolean> {
  if (!newManagerId) return false;
  if (newManagerId === entityId) return true;

  const allEmployees = await db.select().from(employees);
  const allAgents = await db.select().from(agents);

  const managerMap = new Map<string, string | null>();
  for (const e of allEmployees) managerMap.set(e.id, e.managerId);
  for (const a of allAgents) managerMap.set(a.id, a.managerId);

  // Simulate the change
  managerMap.set(entityId, newManagerId);

  // Walk up from newManagerId
  const visited = new Set<string>();
  let current: string | null | undefined = newManagerId;
  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = managerMap.get(current) ?? null;
  }
  return false;
}

// List all agents
app.get("/", async (c) => {
  const result = await db.select().from(agents);
  return c.json(result);
});

// Get agent by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) {
    return c.json({ error: "Invalid agent ID format" }, 400);
  }
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json(agent);
});

// Create agent + generate API key
app.post("/", zValidator("json", createAgentSchema), async (c) => {
  const { name, type, permissions, metadata } = c.req.valid("json");

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
app.patch("/:id", zValidator("json", updateAgentSchema), async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) {
    return c.json({ error: "Invalid agent ID format" }, 400);
  }
  const body = c.req.valid("json");

  // Cycle detection for managerId changes
  if (body.managerId !== undefined) {
    if (body.managerId && !isValidUuid(body.managerId)) {
      return c.json({ error: "Invalid managerId format" }, 400);
    }
    const cycle = await wouldCreateCycle(id, body.managerId);
    if (cycle) {
      return c.json({ error: "Cannot set manager: would create a circular reporting chain" }, 400);
    }
  }

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

  broadcast({ type: "agent:heartbeat", data: updated, timestamp: new Date().toISOString() });
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
