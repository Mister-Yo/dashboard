import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { enqueueTask, getQueueStats } from "../services/queue";
import { isValidUuid } from "../lib/utils";

const app = new Hono();

const enqueueSchema = z.object({
  taskId: z.string().uuid(),
  agentId: z.string().uuid(),
  action: z.enum(["execute", "review", "retry"]).default("execute"),
});

// Enqueue a task for an agent
app.post("/enqueue", zValidator("json", enqueueSchema), async (c) => {
  const { taskId, agentId, action } = c.req.valid("json");

  const job = await enqueueTask(taskId, agentId, action);
  return c.json({ jobId: job.id, taskId, agentId, action }, 201);
});

// Get queue statistics
app.get("/stats", async (c) => {
  const stats = await getQueueStats();
  return c.json(stats);
});

export default app;
