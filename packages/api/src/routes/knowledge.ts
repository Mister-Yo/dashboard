import { Hono } from "hono";
import { eq, ilike, or, sql, isNull, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import { knowledgeEntries } from "../db/schema";
import { isValidUuid } from "../lib/utils";
import { generateEmbedding } from "../services/embeddings";
import { chunkText } from "../services/chunker";
import { logger } from "../lib/logger";
import { broadcast } from "./sse";

const CHUNK_THRESHOLD = 2000; // chars — chunk if content exceeds this

const createKnowledgeSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  url: z.string().url().nullable().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(["telegram", "twitter", "manual", "agent", "email"]).optional().default("manual"),
  sourceMessageId: z.string().nullable().optional(),
});

const updateKnowledgeSchema = createKnowledgeSchema.partial();

const ingestSchema = z.object({
  url: z.string().url(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const app = new Hono();

// List knowledge entries (with optional search) — excludes chunks
app.get("/", async (c) => {
  const search = c.req.query("search");
  const source = c.req.query("source");
  const includeChunks = c.req.query("include_chunks") === "true";

  const chunkFilter = includeChunks ? undefined : isNull(knowledgeEntries.parentEntryId);

  if (search) {
    const conditions = [
      or(
        ilike(knowledgeEntries.title, `%${search}%`),
        ilike(knowledgeEntries.summary, `%${search}%`)
      ),
    ];
    if (chunkFilter) conditions.push(chunkFilter);

    const result = await db
      .select()
      .from(knowledgeEntries)
      .where(and(...conditions));
    return c.json(result);
  }

  const validSources = ["telegram", "twitter", "manual", "agent", "system"] as const;
  if (source && validSources.includes(source as typeof validSources[number])) {
    const conditions = [
      eq(knowledgeEntries.source, source as typeof validSources[number]),
    ];
    if (chunkFilter) conditions.push(chunkFilter);

    const result = await db
      .select()
      .from(knowledgeEntries)
      .where(and(...conditions));
    return c.json(result);
  }

  const result = chunkFilter
    ? await db.select().from(knowledgeEntries).where(chunkFilter)
    : await db.select().from(knowledgeEntries);
  return c.json(result);
});

// Semantic search using pgvector embeddings — returns chunks for precision
app.get("/semantic", async (c) => {
  const query = c.req.query("q");
  if (!query) return c.json({ error: "Query parameter 'q' is required" }, 400);

  const limit = Math.min(parseInt(c.req.query("limit") ?? "10"), 50);

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    // Fallback to text search if embeddings unavailable
    const result = await db
      .select()
      .from(knowledgeEntries)
      .where(
        or(
          ilike(knowledgeEntries.title, `%${query}%`),
          ilike(knowledgeEntries.summary, `%${query}%`)
        )
      )
      .limit(limit);
    return c.json({ results: result, method: "text" });
  }

  const embeddingStr = `[${queryEmbedding.join(",")}]`;
  const result = await db.execute(
    sql`SELECT id, title, url, summary, tags, source, parent_entry_id, chunk_index, created_at,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM knowledge_entries
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}`
  );

  return c.json({ results: result, method: "semantic" });
});

// ─── Hybrid Search: vector + full-text with Reciprocal Rank Fusion ───
app.get("/search", async (c) => {
  const query = c.req.query("q");
  if (!query) return c.json({ error: "Query parameter 'q' is required" }, 400);

  const limit = Math.min(parseInt(c.req.query("limit") ?? "10"), 50);
  const mode = (c.req.query("mode") ?? "hybrid") as "hybrid" | "semantic" | "keyword";
  const K = 60; // RRF constant

  // ── Keyword search (tsvector BM25) ──
  let keywordResults: { id: string; rank: number }[] = [];
  if (mode === "keyword" || mode === "hybrid") {
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, ""))
      .filter(Boolean)
      .join(" & ");

    if (tsQuery) {
      const kwRows = await db.execute(
        sql`SELECT id,
              ts_rank_cd(search_vector, to_tsquery('english', ${tsQuery})) as rank
            FROM knowledge_entries
            WHERE search_vector @@ to_tsquery('english', ${tsQuery})
              AND parent_entry_id IS NULL
            ORDER BY rank DESC
            LIMIT ${limit * 2}`
      );
      keywordResults = (kwRows as unknown as { id: string; rank: number }[]);
    }
  }

  // ── Semantic search (pgvector cosine) ──
  let semanticResults: { id: string; similarity: number }[] = [];
  if (mode === "semantic" || mode === "hybrid") {
    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding) {
      const embeddingStr = `[${queryEmbedding.join(",")}]`;
      const semRows = await db.execute(
        sql`SELECT id,
              1 - (embedding <=> ${embeddingStr}::vector) as similarity
            FROM knowledge_entries
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${embeddingStr}::vector
            LIMIT ${limit * 2}`
      );
      semanticResults = (semRows as unknown as { id: string; similarity: number }[]);
    }
  }

  // ── Single-mode return ──
  if (mode === "keyword") {
    const ids = keywordResults.slice(0, limit).map((r) => r.id);
    if (ids.length === 0) return c.json({ results: [], method: "keyword" });

    const entries = await db
      .select()
      .from(knowledgeEntries)
      .where(inArray(knowledgeEntries.id, ids));
    return c.json({ results: entries, method: "keyword" });
  }

  if (mode === "semantic") {
    const ids = semanticResults.slice(0, limit).map((r) => r.id);
    if (ids.length === 0) return c.json({ results: [], method: "semantic" });

    const entries = await db
      .select()
      .from(knowledgeEntries)
      .where(inArray(knowledgeEntries.id, ids));
    return c.json({ results: entries, method: "semantic" });
  }

  // ── Hybrid: Reciprocal Rank Fusion ──
  const scores = new Map<string, number>();

  keywordResults.forEach((r, i) => {
    const rrf = 1 / (K + i + 1);
    scores.set(r.id, (scores.get(r.id) ?? 0) + rrf);
  });

  semanticResults.forEach((r, i) => {
    const rrf = 1 / (K + i + 1);
    scores.set(r.id, (scores.get(r.id) ?? 0) + rrf);
  });

  const sorted = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (sorted.length === 0) return c.json({ results: [], method: "hybrid" });

  const topIds = sorted.map(([id]) => id);
  const entries = await db
    .select()
    .from(knowledgeEntries)
    .where(inArray(knowledgeEntries.id, topIds));

  // Re-order by RRF score
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const orderedResults = topIds.map((id) => entryMap.get(id)).filter(Boolean);

  return c.json({
    results: orderedResults,
    method: "hybrid",
    meta: {
      keywordHits: keywordResults.length,
      semanticHits: semanticResults.length,
      fusedCount: sorted.length,
    },
  });
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

// Get chunks for a parent entry
app.get("/:id/chunks", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid ID format" }, 400);

  const chunks = await db
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.parentEntryId, id))
    .orderBy(knowledgeEntries.chunkIndex);

  return c.json(chunks);
});

// Create knowledge entry — with automatic chunking for long content
app.post("/", zValidator("json", createKnowledgeSchema), async (c) => {
  const { title, url, content, summary, tags, source, sourceMessageId } = c.req.valid("json");

  // Generate embedding for the full document
  const embeddingText = `${title}\n${summary ?? ""}\n${content}`;
  const embedding = await generateEmbedding(embeddingText);

  // Insert the parent entry
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
      embedding,
    })
    .returning();

  // If content is long, create chunks with individual embeddings
  let chunksCreated = 0;
  if (content.length > CHUNK_THRESHOLD) {
    const chunks = chunkText(content);
    if (chunks.length > 1) {
      logger.info({ entryId: entry.id, chunks: chunks.length }, "Chunking knowledge entry");

      for (const chunk of chunks) {
        const chunkEmbeddingText = `${title}\n${chunk.text}`;
        const chunkEmbedding = await generateEmbedding(chunkEmbeddingText);

        await db.insert(knowledgeEntries).values({
          title: `${title} [chunk ${chunk.index + 1}/${chunks.length}]`,
          url: url ?? null,
          content: chunk.text,
          summary: "",
          tags: tags ?? [],
          source,
          sourceMessageId: sourceMessageId ?? null,
          embedding: chunkEmbedding,
          parentEntryId: entry.id,
          chunkIndex: chunk.index,
        });
      }
      chunksCreated = chunks.length;
    }
  }

  broadcast({ type: "knowledge:created", data: { id: entry.id, title: entry.title }, timestamp: new Date().toISOString() });
  return c.json({ ...entry, chunksCreated }, 201);
});

// Update knowledge entry
app.patch("/:id", zValidator("json", updateKnowledgeSchema), async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const body = c.req.valid("json");

  const [updated] = await db
    .update(knowledgeEntries)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(knowledgeEntries.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Knowledge entry not found" }, 404);
  }

  // If content changed, re-chunk
  if (body.content && body.content.length > CHUNK_THRESHOLD) {
    // Delete old chunks
    await db
      .delete(knowledgeEntries)
      .where(eq(knowledgeEntries.parentEntryId, id));

    // Create new chunks
    const chunks = chunkText(body.content);
    if (chunks.length > 1) {
      const entryTitle = body.title ?? updated.title;
      for (const chunk of chunks) {
        const chunkEmbeddingText = `${entryTitle}\n${chunk.text}`;
        const chunkEmbedding = await generateEmbedding(chunkEmbeddingText);

        await db.insert(knowledgeEntries).values({
          title: `${entryTitle} [chunk ${chunk.index + 1}/${chunks.length}]`,
          url: updated.url,
          content: chunk.text,
          summary: "",
          tags: updated.tags as string[],
          source: updated.source,
          embedding: chunkEmbedding,
          parentEntryId: id,
          chunkIndex: chunk.index,
        });
      }
    }
  }

  broadcast({ type: "knowledge:updated", data: { id: updated.id, title: updated.title }, timestamp: new Date().toISOString() });
  return c.json(updated);
});

// Ingest URL — fetch content, extract text, optionally summarize with AI, save
app.post("/ingest", zValidator("json", ingestSchema), async (c) => {
  const { url, source, tags: inputTags } = c.req.valid("json");

  try {
    // 1. Fetch the URL
    const response = await fetch(url, {
      headers: {
        "User-Agent": "AI-Company-Dashboard-Bot/1.0",
        "Accept": "text/html,application/xhtml+xml,text/plain,*/*",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return c.json({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` }, 400);
    }

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    // 2. Extract meaningful text from HTML
    let extractedText = rawText;
    let extractedTitle = url;

    if (contentType.includes("text/html")) {
      const titleMatch = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        extractedTitle = titleMatch[1].replace(/\s+/g, " ").trim();
      }

      let metaDescription = "";
      const metaMatch = rawText.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)
        || rawText.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);
      if (metaMatch) {
        metaDescription = metaMatch[1].trim();
      }

      extractedText = rawText
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();

      if (extractedText.length > 10000) {
        extractedText = extractedText.substring(0, 10000) + "...";
      }

      if (metaDescription) {
        extractedText = `${metaDescription}\n\n${extractedText}`;
      }
    }

    // 3. Try to summarize with Claude (if API key available)
    let summary = "";
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey && extractedText.length > 100) {
      try {
        const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            messages: [{
              role: "user",
              content: `Summarize the following web page content in 2-3 sentences. Be concise and factual.\n\nTitle: ${extractedTitle}\nURL: ${url}\n\nContent:\n${extractedText.substring(0, 4000)}`,
            }],
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json() as { content: { text: string }[] };
          summary = aiResult.content?.[0]?.text ?? "";
        }
      } catch {
        // AI summarization failed, continue without it
      }
    }

    // 4. Auto-detect tags from URL
    const autoTags: string[] = [...(inputTags ?? [])];
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      autoTags.push(hostname);
    } catch {}

    if (!summary && extractedText.length > 200) {
      summary = extractedText.substring(0, 200) + "...";
    }

    // 5. Generate embedding
    const embeddingText = `${extractedTitle}\n${summary}\n${extractedText}`;
    const embedding = await generateEmbedding(embeddingText);

    // 6. Save to knowledge base
    const [entry] = await db
      .insert(knowledgeEntries)
      .values({
        title: extractedTitle.substring(0, 500),
        url,
        content: extractedText,
        summary,
        tags: autoTags,
        source: source ?? "manual",
        embedding,
      })
      .returning();

    // 7. Chunk if content is long
    let chunksCreated = 0;
    if (extractedText.length > CHUNK_THRESHOLD) {
      const chunks = chunkText(extractedText);
      if (chunks.length > 1) {
        logger.info({ entryId: entry.id, chunks: chunks.length }, "Chunking ingested content");

        for (const chunk of chunks) {
          const chunkEmbeddingText = `${entry.title}\n${chunk.text}`;
          const chunkEmbedding = await generateEmbedding(chunkEmbeddingText);

          await db.insert(knowledgeEntries).values({
            title: `${entry.title} [chunk ${chunk.index + 1}/${chunks.length}]`,
            url,
            content: chunk.text,
            summary: "",
            tags: autoTags,
            source: source ?? "manual",
            embedding: chunkEmbedding,
            parentEntryId: entry.id,
            chunkIndex: chunk.index,
          });
        }
        chunksCreated = chunks.length;
      }
    }

    broadcast({ type: "knowledge:created", data: { id: entry.id, title: entry.title }, timestamp: new Date().toISOString() });

    return c.json({
      entry,
      meta: {
        contentLength: extractedText.length,
        hasSummary: summary.length > 0,
        aiSummarized: summary.length > 0 && summary !== extractedText.substring(0, 200) + "...",
        chunksCreated,
      },
    }, 201);
  } catch (err) {
    return c.json({
      error: "Failed to ingest URL",
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});

// Delete knowledge entry (+ its chunks)
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id)) return c.json({ error: "Invalid ID format" }, 400);

  // Delete chunks first
  await db
    .delete(knowledgeEntries)
    .where(eq(knowledgeEntries.parentEntryId, id));

  const [deleted] = await db
    .delete(knowledgeEntries)
    .where(eq(knowledgeEntries.id, id))
    .returning();

  if (!deleted) {
    return c.json({ error: "Knowledge entry not found" }, 404);
  }

  broadcast({ type: "knowledge:deleted", data: { id }, timestamp: new Date().toISOString() });
  return c.json({ ok: true });
});

export default app;
