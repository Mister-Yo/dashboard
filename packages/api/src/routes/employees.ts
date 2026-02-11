import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import { employees } from "../db/schema";
import { generateApiKey } from "../services/api-key";
import { isValidUuid } from "../lib/utils";
import { requireAuth } from "../middleware/api-key";

const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  email: z.string().email().optional(),
  telegramUsername: z.string().optional().nullable(),
  telegramChatId: z.string().optional().nullable(),
  password: z.string().min(4).optional(),
  status: z.enum(["active", "inactive", "pending"]).optional(),
  workStatus: z.enum(["working", "idle", "off", "waiting"]).optional(),
  managerId: z.string().uuid().nullable().optional(),
  currentTaskDescription: z.string().optional().nullable(),
  assignedProjectIds: z.array(z.string()).optional(),
});

const app = new Hono();

/* ─── Helpers ──────────────────────────────────────────── */

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Support legacy SHA256 hashes (migration path)
  if (!hash.startsWith("$argon2")) {
    const sha256 = createHash("sha256").update(password).digest("hex");
    return sha256 === hash;
  }
  return Bun.password.verify(password, hash);
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
      passwordHash: await hashPassword(password),
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

  const passwordValid = await verifyPassword(password, employee.passwordHash);
  if (!passwordValid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Auto-migrate legacy SHA256 to Argon2id on successful login
  if (!employee.passwordHash.startsWith("$argon2")) {
    const newHash = await hashPassword(password);
    await db.update(employees).set({ passwordHash: newHash }).where(eq(employees.id, employee.id));
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
      passwordHash: password ? await hashPassword(password) : null,
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
app.patch("/:id", zValidator("json", updateEmployeeSchema), async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) {
    return c.json({ error: "Invalid employee ID format" }, 400);
  }
  const body = c.req.valid("json");
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  // Whitelist fields
  if (body.name !== undefined) updateData.name = body.name;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.telegramUsername !== undefined) updateData.telegramUsername = body.telegramUsername;
  if (body.telegramChatId !== undefined) updateData.telegramChatId = body.telegramChatId;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.workStatus !== undefined) updateData.workStatus = body.workStatus;
  if (body.currentTaskDescription !== undefined) updateData.currentTaskDescription = body.currentTaskDescription;
  if (body.assignedProjectIds !== undefined) updateData.assignedProjectIds = body.assignedProjectIds;

  // If password is being updated, hash it
  if (body.password) {
    updateData.passwordHash = await hashPassword(body.password);
  }

  // Cycle detection for managerId changes
  if (body.managerId !== undefined) {
    const cycle = await wouldCreateCycle(id, body.managerId);
    if (cycle) {
      return c.json({ error: "Cannot set manager: would create a circular reporting chain" }, 400);
    }
    updateData.managerId = body.managerId;
  }

  const [updated] = await db
    .update(employees)
    .set(updateData)
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
