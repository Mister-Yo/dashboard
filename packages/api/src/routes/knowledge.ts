import { Hono } from "hono";
import { eq, ilike, or } from "drizzle-orm";
import { db } from "../db";
import { knowledgeEntries } from "../db/schema";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string): boolean { return UUID_RE.test(id); }

// List knowledge entries (with optional search)
app.get("/", async (c) => {
  const search = c.req.query("search");
  const source = c.req.query("source");

  if (search) {
    const result = await db
      .select()
      .from(knowledgeEntries)
      .where(
        or(
          ilike(knowledgeEntries.title, `%${search}%`),
          ilike(knowledgeEntries.summary, `%${search}%`)
        )
      );
    return c.json(result);
  }

  if (source) {
    const result = await db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.source, source as any));
    return c.json(result);
  }

  const result = await db.select().from(knowledgeEntries);
  return c.json(result);
});

// Get entry by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const [entry] = await db
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.id, id));

  if (!entry) {
    return c.json({ error: "Knowledge entry not found" }, 404);
  }

  return c.json(entry);
});

// Create knowledge entry
app.post("/", async (c) => {
  const body = await c.req.json();
  const { title, url, content, summary, tags, source, sourceMessageId } = body;

  if (!title || !content || !source) {
    return c.json({ error: "title, content, and source are required" }, 400);
  }

  const [entry] = await db
    .insert(knowledgeEntries)
    .values({
      title,
      url: url ?? null,
      content,
      summary: summary ?? "",
      tags: tags ?? [],
      source,
      sourceMessageId: sourceMessageId ?? null,
    })
    .returning();

  return c.json(entry, 201);
});

// Update knowledge entry
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const body = await c.req.json();

  const [updated] = await db
    .update(knowledgeEntries)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(knowledgeEntries.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Knowledge entry not found" }, 404);
  }

  return c.json(updated);
});

// Delete knowledge entry
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const [deleted] = await db
    .delete(knowledgeEntries)
    .where(eq(knowledgeEntries.id, id))
    .returning();

  if (!deleted) {
    return c.json({ error: "Knowledge entry not found" }, 404);
  }

  return c.json({ ok: true });
});

export default app;
