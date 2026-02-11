import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { db } from "../db";
import { agents, tasks, projects } from "../db/schema";

const app = new Hono();

// In-memory event bus for broadcasting changes
type EventHandler = (event: SSEEvent) => void;
interface SSEEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

const subscribers = new Set<EventHandler>();

export function broadcast(event: SSEEvent) {
  for (const handler of subscribers) {
    try {
      handler(event);
    } catch {
      // subscriber disconnected
    }
  }
}

// SSE stream endpoint — clients connect and receive real-time updates
app.get("/stream", (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial state
    const [agentList, taskList, projectList] = await Promise.all([
      db.select().from(agents),
      db.select().from(tasks),
      db.select().from(projects),
    ]);

    await stream.writeSSE({
      event: "init",
      data: JSON.stringify({
        agents: agentList,
        tasks: taskList,
        projects: projectList,
      }),
    });

    // Subscribe to events
    const handler: EventHandler = (event) => {
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event.data),
      }).catch(() => {
        // stream closed
        subscribers.delete(handler);
      });
    };
    subscribers.add(handler);

    // Send heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ time: new Date().toISOString() }),
      }).catch(() => {
        clearInterval(heartbeat);
        subscribers.delete(handler);
      });
    }, 30_000);

    // Wait until stream is closed
    stream.onAbort(() => {
      clearInterval(heartbeat);
      subscribers.delete(handler);
    });

    // Keep stream open
    await new Promise(() => {});
  });
});

// Get subscriber count
app.get("/status", (c) => {
  return c.json({ subscribers: subscribers.size });
});

export default app;
