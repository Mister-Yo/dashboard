import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { projects, blockers, achievements } from "../db/schema";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string): boolean { return UUID_RE.test(id); }

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

  return c.json(project, 201);
});

// Update project
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid project ID format" }, 400);
  const body = await c.req.json();

  const [updated] = await db
    .update(projects)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Project not found" }, 404);
  }

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

  return c.json({ ok: true });
});

export default app;
