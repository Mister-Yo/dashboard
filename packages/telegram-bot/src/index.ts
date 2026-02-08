import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const bot = new Bot(token);

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Helper to call the API
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return res.json();
}

// /start - Welcome message
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Welcome to AI Company Dashboard Bot!\n\n" +
      "Commands:\n" +
      "/status - View all projects status\n" +
      "/projects - List projects\n" +
      "/agents - List agents and their status\n" +
      "/task <title> - Create a new task\n" +
      "/delegate <agent> <task> - Delegate task to agent\n\n" +
      "Send me a URL to add it to the knowledge base."
  );
});

// /status - Overview of all projects
bot.command("status", async (ctx) => {
  try {
    const projects = await api<any[]>("/api/projects");

    if (projects.length === 0) {
      await ctx.reply("No projects yet.");
      return;
    }

    const lines = projects.map(
      (p) => `${p.status === "active" ? "🟢" : p.status === "blocked" ? "🔴" : "🟡"} *${p.name}* — ${p.status}`
    );

    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (e) {
    await ctx.reply("Failed to fetch status. Is the API running?");
  }
});

// /projects - List projects
bot.command("projects", async (ctx) => {
  try {
    const projects = await api<any[]>("/api/projects");

    if (projects.length === 0) {
      await ctx.reply("No projects yet.");
      return;
    }

    const lines = projects.map(
      (p) => `• *${p.name}* (${p.status})\n  ${p.description || "No description"}`
    );

    await ctx.reply(lines.join("\n\n"), { parse_mode: "Markdown" });
  } catch (e) {
    await ctx.reply("Failed to fetch projects.");
  }
});

// /agents - List agents
bot.command("agents", async (ctx) => {
  try {
    const agents = await api<any[]>("/api/agents");

    if (agents.length === 0) {
      await ctx.reply("No agents registered.");
      return;
    }

    const lines = agents.map(
      (a) =>
        `${a.status === "working" ? "🔵" : a.status === "idle" ? "🟡" : a.status === "error" ? "🔴" : "🟢"} *${a.name}* — ${a.status}`
    );

    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (e) {
    await ctx.reply("Failed to fetch agents.");
  }
});

// /task <title> - Quick task creation
bot.command("task", async (ctx) => {
  const title = ctx.match;

  if (!title) {
    await ctx.reply("Usage: /task <task title>");
    return;
  }

  try {
    const task = await api<any>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title,
        assigneeType: "ceo",
        assigneeId: "ceo",
        delegatedBy: "ceo",
        priority: "medium",
      }),
    });

    await ctx.reply(`Task created: *${task.title}*\nID: \`${task.id}\``, {
      parse_mode: "Markdown",
    });
  } catch (e) {
    await ctx.reply("Failed to create task.");
  }
});

// URL detection - add to knowledge base
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const urlRegex = /https?:\/\/[^\s]+/;

  if (urlRegex.test(text)) {
    try {
      const entry = await api<any>("/api/knowledge", {
        method: "POST",
        body: JSON.stringify({
          title: text.substring(0, 100),
          url: text.match(urlRegex)?.[0],
          content: text,
          source: "telegram",
          sourceMessageId: String(ctx.message.message_id),
        }),
      });

      await ctx.reply(`Added to knowledge base.\nID: \`${entry.id}\``, {
        parse_mode: "Markdown",
      });
    } catch (e) {
      await ctx.reply("Failed to save to knowledge base.");
    }
  }
});

// Start bot
bot.start();
console.log("Telegram bot started");
