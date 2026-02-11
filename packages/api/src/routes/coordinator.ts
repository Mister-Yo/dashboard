import { Hono } from "hono";
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "../db";
import { coordThreads, coordMessages, agents } from "../db/schema";
import { broadcast } from "./sse";
import { logger } from "../lib/logger";

const app = new Hono();

// ─── AI Auto-Reply (fire-and-forget) ──────────────────

async function generateAgentReply(threadId: string, agentId: string, userMessage: string) {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return;

    // Get agent info
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!agent) return;

    // Get recent conversation history (last 20 messages)
    const history = await db
      .select()
      .from(coordMessages)
      .where(eq(coordMessages.threadId, threadId))
      .orderBy(desc(coordMessages.createdAt))
      .limit(20);

    // Build messages for Claude (reverse to chronological order)
    const chatMessages = history.reverse().map((msg) => ({
      role: msg.senderId === agent.name ? "assistant" as const : "user" as const,
      content: (msg.payload as any)?.text ?? "",
    })).filter(m => m.content);

    const systemPrompt = `You are ${agent.name}, an AI agent working in a company dashboard system.
Your type: ${agent.type}. Your status: ${agent.status}.
You are an AI employee at this company. Answer concisely and helpfully.
The CEO is messaging you directly. Be professional but friendly.
Answer in the same language the user writes to you (if Russian, answer in Russian).`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "Anthropic API error in DM reply");
      return;
    }

    const data = await response.json() as {
      content: { type: string; text: string }[];
    };

    const replyText = data.content?.[0]?.text;
    if (!replyText) return;

    // Save agent reply as new message
    const [reply] = await db
      .insert(coordMessages)
      .values({
        threadId,
        senderId: agent.name,
        messageType: "note",
        payload: { text: replyText },
      })
      .returning();

    broadcast({
      type: "coord:message:created",
      data: { ...reply, threadId },
      timestamp: new Date().toISOString(),
    });

    logger.info({ agentId, threadId }, "Agent auto-reply sent");
  } catch (err) {
    logger.error({ err, agentId, threadId }, "Failed to generate agent reply");
  }
}

// ─── Threads ───────────────────────────────────────────

// List threads (optional filters: project_id, task_id, thread_type, created_by)
app.get("/", async (c) => {
  const projectId = c.req.query("project_id");
  const taskId = c.req.query("task_id");
  const threadType = c.req.query("thread_type");
  const createdBy = c.req.query("created_by");

  const conditions = [];
  if (projectId) conditions.push(eq(coordThreads.projectId, projectId));
  if (taskId) conditions.push(eq(coordThreads.taskId, taskId));
  if (threadType) conditions.push(eq(coordThreads.threadType, threadType));
  if (createdBy) conditions.push(eq(coordThreads.createdBy, createdBy));

  const result = await db
    .select()
    .from(coordThreads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(coordThreads.createdAt));

  return c.json(result);
});

// Create thread
app.post("/", async (c) => {
  const body = await c.req.json();

  const [thread] = await db
    .insert(coordThreads)
    .values({
      projectId: body.project_id ?? null,
      taskId: body.task_id ?? null,
      threadType: body.thread_type ?? "general",
      title: body.title ?? null,
      createdBy: body.created_by ?? null,
    })
    .returning();

  broadcast({
    type: "coord:thread:created",
    data: thread,
    timestamp: new Date().toISOString(),
  });

  return c.json(thread, 201);
});

// ─── Direct Messages ──────────────────────────────────

// Find or create a DM thread between current user and participant
app.get("/dm/:participantId", async (c) => {
  const participantId = c.req.param("participantId");
  const jwtUser = c.get("jwtUser" as any);
  const userId = jwtUser?.id ?? "ceo";

  // Look for existing DM thread containing this participant
  const allThreads = await db
    .select()
    .from(coordThreads)
    .where(eq(coordThreads.isDirectMessage, true));

  // Find any DM thread that includes this participantId (agent)
  const existing = allThreads.find((t) => {
    const pids = (t.participantIds as string[]) ?? [];
    return pids.includes(participantId);
  });

  if (existing) {
    return c.json(existing);
  }

  // Get agent name for DM thread title
  let agentName = "Agent";
  try {
    const [agent] = await db.select().from(agents).where(eq(agents.id, participantId));
    if (agent) agentName = agent.name;
  } catch {}

  // Create new DM thread
  const [thread] = await db
    .insert(coordThreads)
    .values({
      threadType: "dm",
      isDirectMessage: true,
      participantIds: [userId, participantId],
      title: `DM: ${agentName}`,
      createdBy: userId,
    })
    .returning();

  broadcast({
    type: "coord:thread:created",
    data: thread,
    timestamp: new Date().toISOString(),
  });

  return c.json(thread, 201);
});

// ─── Messages ──────────────────────────────────────────

// List messages (required: thread_id; optional: sender_id, message_type, since)
app.get("/messages", async (c) => {
  const threadId = c.req.query("thread_id");
  const senderId = c.req.query("sender_id");
  const messageType = c.req.query("message_type");
  const since = c.req.query("since");

  const conditions = [];
  if (threadId) conditions.push(eq(coordMessages.threadId, threadId));
  if (senderId) conditions.push(eq(coordMessages.senderId, senderId));
  if (messageType) conditions.push(eq(coordMessages.messageType, messageType));
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      conditions.push(gte(coordMessages.createdAt, sinceDate));
    }
  }

  const result = await db
    .select()
    .from(coordMessages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(coordMessages.createdAt);

  return c.json(result);
});

// Post message to thread
app.post("/messages", async (c) => {
  const body = await c.req.json();

  if (!body.thread_id) {
    return c.json({ error: "thread_id required" }, 400);
  }

  // Verify thread exists
  const [thread] = await db
    .select()
    .from(coordThreads)
    .where(eq(coordThreads.id, body.thread_id));

  if (!thread) {
    return c.json({ error: "thread_not_found" }, 404);
  }

  const [message] = await db
    .insert(coordMessages)
    .values({
      threadId: body.thread_id,
      senderId: body.sender_id ?? null,
      messageType: body.message_type ?? "note",
      payload: body.payload ?? {},
      replyTo: body.reply_to ?? null,
    })
    .returning();

  broadcast({
    type: "coord:message:created",
    data: { ...message, threadId: body.thread_id },
    timestamp: new Date().toISOString(),
  });

  // Auto-reply: if DM to an agent, generate AI response (fire-and-forget)
  if (thread.isDirectMessage) {
    const participantIds = (thread.participantIds as string[]) ?? [];
    // Find which participant is an agent (not the sender)
    const senderName = body.sender_id;
    const otherParticipantId = participantIds.find((pid) => {
      // The sender's ID won't match a UUID agent ID if sender_id is a name
      return pid !== (c.get("jwtUser" as any)?.id ?? "ceo");
    });

    if (otherParticipantId) {
      const messageText = (body.payload as any)?.text ?? "";
      if (messageText) {
        // Fire-and-forget — don't await, respond to client immediately
        generateAgentReply(thread.id, otherParticipantId, messageText);
      }
    }
  }

  return c.json(message, 201);
});

export default app;
