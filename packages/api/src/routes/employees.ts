import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { db } from "../db";
import { employees } from "../db/schema";
import { generateApiKey } from "../services/api-key";

const app = new Hono();

/* ─── Helpers ──────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/** Walk the manager chain and detect cycles */
async function wouldCreateCycle(
  entityId: string,
  newManagerId: string | null
): Promise<boolean> {
  if (!newManagerId) return false;
  if (newManagerId === entityId) return true;

  const allEmployees = await db.select().from(employees);
  const { agents: agentsTable } = await import("../db/schema");
  const allAgents = await db.select().from(agentsTable);

  const managerMap = new Map<string, string | null>();
  for (const e of allEmployees) managerMap.set(e.id, e.managerId);
  for (const a of allAgents) managerMap.set(a.id, a.managerId);

  // Simulate the change
  managerMap.set(entityId, newManagerId);

  // Walk up from newManagerId
  const visited = new Set<string>();
  let current: string | null | undefined = newManagerId;
  while (current) {
    if (visited.has(current)) return true; // cycle!
    visited.add(current);
    current = managerMap.get(current) ?? null;
  }
  return false;
}

/* ─── Public: Register (self-service) ──────────────────── */

app.post("/register", async (c) => {
  const body = await c.req.json();
  const { name, email, password, role, telegramUsername } = body;

  if (!name || !email || !password) {
    return c.json({ error: "name, email, and password are required" }, 400);
  }

  // Check if email is already used (case-insensitive)
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await db
    .select()
    .from(employees)
    .where(eq(employees.email, normalizedEmail));

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const [employee] = await db
    .insert(employees)
    .values({
      name,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role: role || "employee",
      telegramUsername: telegramUsername ?? null,
      status: "pending",
    })
    .returning();

  return c.json(
    {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      status: employee.status,
      message: "Registration submitted. Awaiting CEO approval.",
    },
    201
  );
});

/* ─── Public: Login ────────────────────────────────────── */

app.post("/login", async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, email));

  if (!employee) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  if (!employee.passwordHash) {
    return c.json({ error: "Account has no password set. Contact admin." }, 401);
  }

  if (employee.passwordHash !== hashPassword(password)) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  if (employee.status === "pending") {
    return c.json(
      { error: "Account pending approval. Contact CEO." },
      403
    );
  }

  if (employee.status === "inactive") {
    return c.json({ error: "Account deactivated. Contact CEO." }, 403);
  }

  // Return employee info (simple token = employee id for now)
  return c.json({
    token: employee.id,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      status: employee.status,
    },
  });
});

/* ─── Admin: Approve employee ──────────────────────────── */

app.post("/:id/approve", async (c) => {
  const id = c.req.param("id");

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id));

  if (!employee) {
    return c.json({ error: "Employee not found" }, 404);
  }

  if (employee.status === "active") {
    return c.json({ error: "Employee is already active" }, 400);
  }

  const [updated] = await db
    .update(employees)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(employees.id, id))
    .returning();

  return c.json(updated);
});

/* ─── Admin: Reject (delete pending) ───────────────────── */

app.post("/:id/reject", async (c) => {
  const id = c.req.param("id");

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id));

  if (!employee) {
    return c.json({ error: "Employee not found" }, 404);
  }

  if (employee.status !== "pending") {
    return c.json({ error: "Can only reject pending employees" }, 400);
  }

  const [deleted] = await db
    .delete(employees)
    .where(eq(employees.id, id))
    .returning();

  return c.json({ ok: true, deleted: deleted.name });
});

/* ─── CRUD ─────────────────────────────────────────────── */

// List all employees
app.get("/", async (c) => {
  const result = await db.select().from(employees);
  return c.json(result);
});

// Get employee by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) {
    return c.json({ error: "Invalid employee ID format" }, 400);
  }
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id));

  if (!employee) {
    return c.json({ error: "Employee not found" }, 404);
  }

  return c.json(employee);
});

// Create employee (admin)
app.post("/", async (c) => {
  const body = await c.req.json();
  const { name, role, telegramUsername, email, password } = body;

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
      passwordHash: password ? hashPassword(password) : null,
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
  if (!isValidUuid(id)) {
    return c.json({ error: "Invalid employee ID format" }, 400);
  }
  const body = await c.req.json();

  // If password is being updated, hash it
  if (body.password) {
    body.passwordHash = hashPassword(body.password);
    delete body.password;
  }

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
