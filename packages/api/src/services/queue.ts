import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { db } from "../db";
import { tasks, agents } from "../db/schema";
import { eq } from "drizzle-orm";
import { broadcast } from "../routes/sse";
import { logger } from "../lib/logger";

// Redis connection for BullMQ
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// ─── Task Queue ─────────────────────────────────────────
export const taskQueue = new Queue("agent-tasks", { connection });

export interface TaskJobData {
  taskId: string;
  agentId: string;
  action: "execute" | "review" | "retry";
}

// ─── Worker ─────────────────────────────────────────────
const worker = new Worker<TaskJobData>(
  "agent-tasks",
  async (job: Job<TaskJobData>) => {
    const { taskId, agentId, action } = job.data;

    // Update task status to in_progress
    const [task] = await db
      .update(tasks)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Update agent to show it's working on this task
    await db
      .update(agents)
      .set({
        currentTaskId: taskId,
        status: "active",
        lastHeartbeat: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    broadcast({
      type: "task:assigned",
      data: { taskId, agentId, action, title: task.title },
      timestamp: new Date().toISOString(),
    });

    // Log progress
    await job.updateProgress(50);

    // The actual agent work happens externally (Claude Code, Codex, etc.)
    // This queue manages the lifecycle: assign, track, timeout, retry
    // Agents call POST /api/agents/:id/heartbeat and PATCH /api/tasks/:id to update status

    return { taskId, agentId, status: "assigned" };
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, taskId: job.data.taskId, agentId: job.data.agentId }, "Queue job completed");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Queue job failed");
  if (job) {
    broadcast({
      type: "task:failed",
      data: { taskId: job.data.taskId, agentId: job.data.agentId, error: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── Helper: Enqueue a task for an agent ────────────────
export async function enqueueTask(taskId: string, agentId: string, action: "execute" | "review" | "retry" = "execute") {
  const job = await taskQueue.add(
    `${action}:${taskId}`,
    { taskId, agentId, action },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
    }
  );
  return job;
}

// ─── Queue stats ────────────────────────────────────────
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    taskQueue.getWaitingCount(),
    taskQueue.getActiveCount(),
    taskQueue.getCompletedCount(),
    taskQueue.getFailedCount(),
    taskQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

// ─── Graceful shutdown ──────────────────────────────────
export async function closeQueue() {
  await worker.close();
  await taskQueue.close();
  await connection.quit();
}
