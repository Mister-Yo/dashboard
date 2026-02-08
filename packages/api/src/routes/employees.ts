import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { employees } from "../db/schema";
import { generateApiKey } from "../services/api-key";

const app = new Hono();

// List all employees
app.get("/", async (c) => {
  const result = await db.select().from(employees);
  return c.json(result);
});

// Get employee by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id));

  if (!employee) {
    return c.json({ error: "Employee not found" }, 404);
  }

  return c.json(employee);
});

// Create employee
app.post("/", async (c) => {
  const body = await c.req.json();
  const { name, role, telegramUsername, email } = body;

  if (!name || !role) {
    return c.json({ error: "name and role are required" }, 400);
  }

  const [employee] = await db
    .insert(employees)
    .values({
      name,
      role,
      telegramUsername: telegramUsername ?? null,
      email: email ?? null,
    })
    .returning();

  return c.json(employee, 201);
});

// Generate API key for employee
app.post("/:id/api-key", async (c) => {
  const id = c.req.param("id");
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id));

  if (!employee) {
    return c.json({ error: "Employee not found" }, 404);
  }

  const apiKeyResult = await generateApiKey("employee", id);

  await db
    .update(employees)
    .set({
      apiKeyPrefix: apiKeyResult.prefix,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, id));

  return c.json({ apiKey: apiKeyResult.key }, 201);
});

// Update employee
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const [updated] = await db
    .update(employees)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(employees.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Employee not found" }, 404);
  }

  return c.json(updated);
});

// Delete employee
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [deleted] = await db
    .delete(employees)
    .where(eq(employees.id, id))
    .returning();

  if (!deleted) {
    return c.json({ error: "Employee not found" }, 404);
  }

  return c.json({ ok: true });
});

export default app;
