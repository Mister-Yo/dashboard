import { Hono } from "hono";
import { db } from "../db";
import { sql } from "drizzle-orm";

const app = new Hono();

// GET /api/analytics/summary — aggregated dashboard data
app.get("/summary", async (c) => {
  try {
    const [
      completedByDay,
      byStatus,
      byPriority,
      agentUtil,
      avgCompletionByWeek,
      blockersByWeek,
    ] = await Promise.all([
      // Tasks completed per day (last 30 days)
      db.execute(sql`
        SELECT DATE(completed_at) as date, COUNT(*)::int as count
        FROM tasks
        WHERE completed_at IS NOT NULL
          AND completed_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(completed_at)
        ORDER BY date
      `),

      // Tasks by status
      db.execute(sql`
        SELECT status, COUNT(*)::int as count
        FROM tasks
        GROUP BY status
        ORDER BY count DESC
      `),

      // Tasks by priority
      db.execute(sql`
        SELECT priority, COUNT(*)::int as count
        FROM tasks
        GROUP BY priority
      `),

      // Agent utilization
      db.execute(sql`
        SELECT
          a.name as agent_name,
          a.work_status,
          a.status as agent_status,
          (SELECT COUNT(*)::int FROM tasks t WHERE t.assignee_id = a.id::text AND t.status = 'completed') as tasks_completed,
          (SELECT COUNT(*)::int FROM tasks t WHERE t.assignee_id = a.id::text AND t.status IN ('in_progress','review')) as tasks_active
        FROM agents a
        ORDER BY a.name
      `),

      // Avg completion time by week (last 90 days)
      db.execute(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('week', completed_at), 'YYYY-MM-DD') as week,
          ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600)::numeric, 1) as avg_hours
        FROM tasks
        WHERE completed_at IS NOT NULL
          AND completed_at > NOW() - INTERVAL '90 days'
        GROUP BY DATE_TRUNC('week', completed_at)
        ORDER BY week
      `),

      // Blockers by week (last 90 days)
      db.execute(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('week', reported_at), 'YYYY-MM-DD') as week,
          COUNT(*)::int as count
        FROM blockers
        WHERE reported_at > NOW() - INTERVAL '90 days'
        GROUP BY DATE_TRUNC('week', reported_at)
        ORDER BY week
      `),
    ]);

    return c.json({
      tasksCompletedByDay: completedByDay as unknown as Record<string, unknown>[],
      tasksByStatus: byStatus as unknown as Record<string, unknown>[],
      tasksByPriority: byPriority as unknown as Record<string, unknown>[],
      agentUtilization: agentUtil as unknown as Record<string, unknown>[],
      avgCompletionTimeByWeek: avgCompletionByWeek as unknown as Record<string, unknown>[],
      blockersByWeek: blockersByWeek as unknown as Record<string, unknown>[],
    });
  } catch (err) {
    return c.json({ error: "Failed to fetch analytics", detail: err instanceof Error ? err.message : "unknown" }, 500);
  }
});

export default app;
