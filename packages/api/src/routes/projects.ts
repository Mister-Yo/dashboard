import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import { projects, blockers, achievements, agents, employees, strategyChanges } from "../db/schema";
import { isValidUuid } from "../lib/utils";
import { broadcast } from "./sse";

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  githubRepo: z.string().optional(),
  githubBranch: z.string().optional(),
  strategyPath: z.string().optional(),
  status: z.enum(["active", "paused", "completed", "blocked"]).optional(),
  assignedAgentIds: z.array(z.string()).optional(),
  assignedEmployeeIds: z.array(z.string()).optional(),
});

const app = new Hono();

// List all projects
app.get("/", async (c) => {
  const result = await db.select().from(projects);
  return c.json(result);
});

// Get project by ID (with blockers and achievements)
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid project ID format" }, 400);
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const projectBlockers = await db
    .select()
    .from(blockers)
    .where(eq(blockers.projectId, id));

  const projectAchievements = await db
    .select()
    .from(achievements)
    .where(eq(achievements.projectId, id));

  return c.json({
    ...project,
    blockers: projectBlockers,
    achievements: projectAchievements,
  });
});

// Create project
app.post("/", async (c) => {
  const body = await c.req.json();
  const { name, description, githubRepo, githubBranch } = body;

  if (!name || !githubRepo) {
    return c.json({ error: "name and githubRepo are required" }, 400);
  }

  const [project] = await db
    .insert(projects)
    .values({
      name,
      description: description ?? "",
      githubRepo,
      githubBranch: githubBranch ?? "main",
    })
    .returning();

  broadcast({ type: "project:created", data: { id: project.id, name: project.name }, timestamp: new Date().toISOString() });
  return c.json(project, 201);
});

// Update project (with auto strategy change recording)
app.patch("/:id", zValidator("json", updateProjectSchema), async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid project ID format" }, 400);
  const body = c.req.valid("json");

  // Fetch current project to compute diff
  const [current] = await db.select().from(projects).where(eq(projects.id, id));
  if (!current) return c.json({ error: "Project not found" }, 404);

  const [updated] = await db
    .update(projects)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  // Auto-record strategy change for tracked fields
  const trackedFields = ["description", "status", "strategyPath", "name"] as const;
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const changes: string[] = [];
  for (const field of trackedFields) {
    if (body[field] !== undefined && body[field] !== (current as Record<string, unknown>)[field]) {
      diff[field] = { old: (current as Record<string, unknown>)[field], new: body[field] };
      changes.push(`${field}: "${(current as Record<string, unknown>)[field]}" → "${body[field]}"`);
    }
  }

  if (Object.keys(diff).length > 0) {
    const owner = c.get("apiKeyOwner");
    const authorType = owner?.type ?? "ceo";
    const authorId = owner?.id ?? "system";
    let authorName = "CEO";
    if (owner) {
      if (owner.type === "agent") {
        const [a] = await db.select({ name: agents.name }).from(agents).where(eq(agents.id, owner.id));
        if (a) authorName = a.name;
      } else {
        const [e] = await db.select({ name: employees.name }).from(employees).where(eq(employees.id, owner.id));
        if (e) authorName = e.name;
      }
    }

    const [sc] = await db.insert(strategyChanges).values({
      projectId: id,
      authorType,
      authorId,
      authorName,
      diff: JSON.stringify(diff),
      summary: changes.join("; "),
    }).returning();

    broadcast({ type: "strategy:updated", data: { id: sc.id, projectId: id }, timestamp: new Date().toISOString() });
  }

  broadcast({ type: "project:updated", data: { id: updated.id, name: updated.name }, timestamp: new Date().toISOString() });
  return c.json(updated);
});

// Add blocker to project
app.post("/:id/blockers", async (c) => {
  const projectId = c.req.param("id");
  const body = await c.req.json();

  const [blocker] = await db
    .insert(blockers)
    .values({
      projectId,
      description: body.description,
      severity: body.severity ?? "medium",
      reportedBy: body.reportedBy,
    })
    .returning();

  return c.json(blocker, 201);
});

// Resolve blocker
app.patch("/:id/blockers/:blockerId/resolve", async (c) => {
  const blockerId = c.req.param("blockerId");

  const [resolved] = await db
    .update(blockers)
    .set({ resolvedAt: new Date() })
    .where(eq(blockers.id, blockerId))
    .returning();

  if (!resolved) {
    return c.json({ error: "Blocker not found" }, 404);
  }

  return c.json(resolved);
});

// Add achievement
app.post("/:id/achievements", async (c) => {
  const projectId = c.req.param("id");
  const body = await c.req.json();

  const [achievement] = await db
    .insert(achievements)
    .values({
      projectId,
      description: body.description,
      achievedBy: body.achievedBy,
    })
    .returning();

  return c.json(achievement, 201);
});

// List strategy changes for a project
app.get("/:id/strategy-changes", async (c) => {
  const projectId = c.req.param("id");
  if (!isValidUuid(projectId)) return c.json({ error: "Invalid project ID format" }, 400);

  const result = await db
    .select()
    .from(strategyChanges)
    .where(eq(strategyChanges.projectId, projectId))
    .orderBy(desc(strategyChanges.timestamp));

  return c.json(result);
});

// Record a strategy change manually
app.post("/:id/strategy-changes", async (c) => {
  const projectId = c.req.param("id");
  if (!isValidUuid(projectId)) return c.json({ error: "Invalid project ID format" }, 400);

  const body = await c.req.json();
  const { authorType, authorId, authorName, diff, summary, commitSha } = body;

  if (!authorType || !authorId || !authorName || !diff || !summary) {
    return c.json({ error: "authorType, authorId, authorName, diff, summary required" }, 400);
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const [sc] = await db
    .insert(strategyChanges)
    .values({
      projectId,
      authorType,
      authorId,
      authorName,
      diff: typeof diff === "string" ? diff : JSON.stringify(diff),
      summary,
      commitSha: commitSha ?? null,
    })
    .returning();

  broadcast({ type: "strategy:updated", data: { id: sc.id, projectId }, timestamp: new Date().toISOString() });
  return c.json(sc, 201);
});

// Add member to project
app.post("/:id/members", async (c) => {
  const projectId = c.req.param("id");
  if (!isValidUuid(projectId)) return c.json({ error: "Invalid project ID format" }, 400);

  const body = await c.req.json();
  const { memberId, memberType } = body;

  if (!memberId || !memberType) {
    return c.json({ error: "memberId and memberType (agent|employee) are required" }, 400);
  }
  if (!isValidUuid(memberId)) return c.json({ error: "Invalid member ID format" }, 400);

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  if (memberType === "agent") {
    const [agent] = await db.select().from(agents).where(eq(agents.id, memberId));
    if (!agent) return c.json({ error: "Agent not found" }, 404);

    await db.transaction(async (tx) => {
      await tx.update(agents).set({ currentProjectId: projectId, updatedAt: new Date() }).where(eq(agents.id, memberId));
      const currentIds = (project.assignedAgentIds ?? []) as string[];
      if (!currentIds.includes(memberId)) {
        await tx.update(projects).set({
          assignedAgentIds: [...currentIds, memberId],
          updatedAt: new Date(),
        }).where(eq(projects.id, projectId));
      }
    });

    return c.json({ ok: true, memberType: "agent", memberId, projectId }, 201);
  } else if (memberType === "employee") {
    const [employee] = await db.select().from(employees).where(eq(employees.id, memberId));
    if (!employee) return c.json({ error: "Employee not found" }, 404);

    await db.transaction(async (tx) => {
      const currentProjectIds = (employee.assignedProjectIds ?? []) as string[];
      if (!currentProjectIds.includes(projectId)) {
        await tx.update(employees).set({
          assignedProjectIds: [...currentProjectIds, projectId],
          updatedAt: new Date(),
        }).where(eq(employees.id, memberId));
      }
      const currentIds = (project.assignedEmployeeIds ?? []) as string[];
      if (!currentIds.includes(memberId)) {
        await tx.update(projects).set({
          assignedEmployeeIds: [...currentIds, memberId],
          updatedAt: new Date(),
        }).where(eq(projects.id, projectId));
      }
    });

    return c.json({ ok: true, memberType: "employee", memberId, projectId }, 201);
  }

  return c.json({ error: "memberType must be 'agent' or 'employee'" }, 400);
});

// Remove member from project
app.delete("/:id/members/:memberId", async (c) => {
  const projectId = c.req.param("id");
  const memberId = c.req.param("memberId");
  if (!isValidUuid(projectId)) return c.json({ error: "Invalid project ID format" }, 400);
  if (!isValidUuid(memberId)) return c.json({ error: "Invalid member ID format" }, 400);

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Check if it's an agent
  const [agent] = await db.select().from(agents).where(eq(agents.id, memberId));
  if (agent) {
    await db.transaction(async (tx) => {
      if (agent.currentProjectId === projectId) {
        await tx.update(agents).set({ currentProjectId: null, updatedAt: new Date() }).where(eq(agents.id, memberId));
      }
      const currentIds = (project.assignedAgentIds ?? []) as string[];
      await tx.update(projects).set({
        assignedAgentIds: currentIds.filter((id) => id !== memberId),
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));
    });
    return c.json({ ok: true, removed: "agent", memberId });
  }

  // Check if it's an employee
  const [employee] = await db.select().from(employees).where(eq(employees.id, memberId));
  if (employee) {
    await db.transaction(async (tx) => {
      const currentProjectIds = (employee.assignedProjectIds ?? []) as string[];
      await tx.update(employees).set({
        assignedProjectIds: currentProjectIds.filter((id) => id !== projectId),
        updatedAt: new Date(),
      }).where(eq(employees.id, memberId));

      const currentIds = (project.assignedEmployeeIds ?? []) as string[];
      await tx.update(projects).set({
        assignedEmployeeIds: currentIds.filter((id) => id !== memberId),
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));
    });
    return c.json({ ok: true, removed: "employee", memberId });
  }

  return c.json({ error: "Member not found" }, 404);
});

// Get project members
app.get("/:id/members", async (c) => {
  const projectId = c.req.param("id");
  if (!isValidUuid(projectId)) return c.json({ error: "Invalid project ID format" }, 400);

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const projectAgents = await db.select().from(agents).where(eq(agents.currentProjectId, projectId));
  const allEmployees = await db.select().from(employees);
  const projectEmployees = allEmployees.filter((e) => {
    const ids = (e.assignedProjectIds ?? []) as string[];
    return ids.includes(projectId);
  });

  return c.json({
    agents: projectAgents.map((a) => ({ id: a.id, name: a.name, type: a.type, status: a.status })),
    employees: projectEmployees.map((e) => ({ id: e.id, name: e.name, role: e.role, status: e.status })),
  });
});

// Delete project
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid project ID format" }, 400);
  const [deleted] = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning();

  if (!deleted) {
    return c.json({ error: "Project not found" }, 404);
  }

  broadcast({ type: "project:deleted", data: { id }, timestamp: new Date().toISOString() });
  return c.json({ ok: true });
});

export default app;
