import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  performanceEvaluations,
  agents,
  employees,
  projects,
  tasks,
  activityEvents,
  knowledgeEntries,
} from "../db/schema";
import { logger } from "../lib/logger";
import { broadcast } from "./sse";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}

// List evaluations
app.get("/", async (c) => {
  const result = await db
    .select()
    .from(performanceEvaluations)
    .orderBy(desc(performanceEvaluations.createdAt));
  return c.json(result);
});

// Get evaluation by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidUuid(id))
    return c.json({ error: "Invalid evaluation ID format" }, 400);
  const [evaluation] = await db
    .select()
    .from(performanceEvaluations)
    .where(eq(performanceEvaluations.id, id));
  if (!evaluation) return c.json({ error: "Evaluation not found" }, 404);
  return c.json(evaluation);
});

// Trigger AI evaluation — collects metrics, sends to Claude, saves report
app.post("/generate", async (c) => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return c.json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }

  const body = await c.req.json().catch(() => ({}));
  const period = body.period ?? "weekly";

  try {
    // 1. Gather all system data
    const [allAgents, allEmployees, allProjects, allTasks, recentActivity] =
      await Promise.all([
        db.select().from(agents),
        db.select().from(employees),
        db.select().from(projects),
        db.select().from(tasks),
        db
          .select()
          .from(activityEvents)
          .orderBy(desc(activityEvents.createdAt))
          .limit(50),
      ]);

    const now = new Date();
    const periodStart = new Date(now);
    if (period === "daily") {
      periodStart.setDate(periodStart.getDate() - 1);
    } else if (period === "weekly") {
      periodStart.setDate(periodStart.getDate() - 7);
    } else {
      periodStart.setMonth(periodStart.getMonth() - 1);
    }

    // 2. Calculate metrics
    const completedTasks = allTasks.filter(
      (t) =>
        t.status === "completed" &&
        t.completedAt &&
        new Date(t.completedAt) >= periodStart
    );
    const blockedTasks = allTasks.filter((t) => t.status === "blocked");
    const pendingTasks = allTasks.filter((t) => t.status === "pending");
    const inProgressTasks = allTasks.filter(
      (t) => t.status === "in_progress"
    );

    const activeAgents = allAgents.filter(
      (a) => a.status === "active" || a.workStatus === "working"
    );
    const staleAgents = allAgents.filter((a) => {
      if (!a.lastHeartbeat) return true;
      const minutesSince =
        (now.getTime() - new Date(a.lastHeartbeat).getTime()) / 60000;
      return minutesSince > 15;
    });

    const activeProjects = allProjects.filter(
      (p) => p.status === "active"
    );

    // 3. Build prompt for Claude
    const systemDataSummary = `
## Company Status Report — ${now.toISOString().split("T")[0]}

### Team
- **Agents (${allAgents.length}):** ${allAgents.map((a) => `${a.name} (${a.workStatus}, heartbeat: ${a.lastHeartbeat ? Math.round((now.getTime() - new Date(a.lastHeartbeat).getTime()) / 60000) + "m ago" : "never"})`).join(", ")}
- **Employees (${allEmployees.length}):** ${allEmployees.map((e) => `${e.name} (${e.role}, ${e.status})`).join(", ")}
- **Stale agents (no heartbeat >15m):** ${staleAgents.length > 0 ? staleAgents.map((a) => a.name).join(", ") : "none"}

### Projects (${allProjects.length})
${allProjects.map((p) => `- **${p.name}** — ${p.status} (repo: ${p.githubRepo})`).join("\n")}

### Tasks Summary
- Total: ${allTasks.length}
- Completed (this ${period}): ${completedTasks.length}
- In Progress: ${inProgressTasks.length}
- Pending: ${pendingTasks.length}
- Blocked: ${blockedTasks.length}

### Task Details
${allTasks.map((t) => `- [${t.status}] ${t.title} (${t.priority}, assigned: ${t.assigneeId})`).join("\n")}

### Recent Activity (last 20 events)
${recentActivity
  .slice(0, 20)
  .map(
    (e) =>
      `- [${e.eventType}] ${e.actorName}: ${e.title} (${new Date(e.createdAt).toISOString().split("T")[0]})`
  )
  .join("\n")}
`;

    const prompt = `You are an AI Controller agent for an AI-centric company management system. Your job is to analyze the current state of the company and produce a performance evaluation report.

${systemDataSummary}

Please provide a comprehensive ${period} performance evaluation report. Include:

1. **Executive Summary** — 2-3 sentence overview of how the company is performing
2. **Agent Performance** — Evaluate each agent's activity, responsiveness (heartbeat), and task completion
3. **Project Health** — Status of each project, any concerns
4. **Task Pipeline** — Analysis of task flow (pending → in_progress → completed), bottlenecks
5. **Risks & Concerns** — Any stale agents, blocked tasks, overdue items
6. **Recommendations** — 3-5 actionable recommendations for the CEO
7. **Score** — Overall company effectiveness score from 1-10 with brief justification

Keep the tone professional but concise. Format as markdown.`;

    // 4. Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return c.json(
        { error: `Claude API error: ${response.status}`, details: errText },
        500
      );
    }

    const claudeResponse = (await response.json()) as {
      content: { type: string; text: string }[];
    };
    const aiAnalysis =
      claudeResponse.content?.[0]?.text ?? "No analysis generated";

    // 5. Save to performanceEvaluations
    const metrics = {
      tasksCompleted: completedTasks.length,
      tasksBlocked: blockedTasks.length,
      avgCompletionTimeHours: 0,
      strategyAdherence: 0,
      codeQuality: null,
      communicationScore: 0,
    };

    const recommendations = [
      `${staleAgents.length} stale agent(s) detected`,
      `${blockedTasks.length} blocked task(s)`,
      `${pendingTasks.length} pending task(s) awaiting action`,
    ];

    const [evaluation] = await db
      .insert(performanceEvaluations)
      .values({
        subjectType: "project",
        subjectId: activeProjects[0]?.id ?? allProjects[0]?.id ?? "00000000-0000-0000-0000-000000000000",
        period,
        periodStart,
        periodEnd: now,
        metrics,
        aiAnalysis,
        recommendations,
      })
      .returning();

    // 6. Also save to knowledge base
    await db.insert(knowledgeEntries).values({
      title: `AI Controller ${period.charAt(0).toUpperCase() + period.slice(1)} Report — ${now.toISOString().split("T")[0]}`,
      content: aiAnalysis,
      summary: `${period} performance evaluation. Tasks completed: ${completedTasks.length}, blocked: ${blockedTasks.length}. Agents: ${activeAgents.length}/${allAgents.length} active.`,
      source: "agent",
      tags: ["ai-controller", "evaluation", period],
    });

    broadcast({ type: "evaluation:created", data: { id: evaluation.id, period }, timestamp: new Date().toISOString() });

    return c.json(
      {
        evaluation,
        summary: {
          tasksCompleted: completedTasks.length,
          tasksBlocked: blockedTasks.length,
          pendingTasks: pendingTasks.length,
          staleAgents: staleAgents.length,
          totalAgents: allAgents.length,
          totalEmployees: allEmployees.length,
        },
      },
      201
    );
  } catch (err) {
    logger.error({ err }, "Evaluation generation failed");
    return c.json(
      {
        error: "Failed to generate evaluation",
        details: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

export default app;
