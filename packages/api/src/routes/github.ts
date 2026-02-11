import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { Octokit } from "@octokit/rest";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { projects, tasks, activityEvents } from "../db/schema";
import { broadcast } from "./sse";

const app = new Hono();

// ─── Webhook Receiver ─────────────────────────────────

function verifySignature(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// POST /api/github/webhooks — receive GitHub webhook events
app.post("/webhooks", async (c) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  const rawBody = await c.req.text();
  const signature = c.req.header("X-Hub-Signature-256");

  if (!verifySignature(rawBody, signature, secret)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = c.req.header("X-GitHub-Event");
  const payload = JSON.parse(rawBody);

  try {
    switch (event) {
      case "issues": {
        await handleIssueEvent(payload);
        break;
      }
      case "push": {
        await handlePushEvent(payload);
        break;
      }
      case "pull_request": {
        await handlePullRequestEvent(payload);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  return c.json({ ok: true });
});

async function handleIssueEvent(payload: any) {
  const repoUrl = payload.repository?.html_url;
  if (!repoUrl) return;

  // Find project by GitHub repo URL
  const allProjects = await db.select().from(projects);
  const project = allProjects.find(
    (p) => p.githubRepo === repoUrl || p.githubRepo === `${repoUrl}.git`
  );

  if (payload.action === "opened") {
    const issue = payload.issue;
    const [task] = await db
      .insert(tasks)
      .values({
        title: `[GH#${issue.number}] ${issue.title}`,
        description: issue.body?.substring(0, 2000) ?? "",
        projectId: project?.id ?? null,
        assigneeType: "ceo",
        assigneeId: "github",
        delegatedBy: `GitHub (${issue.user?.login ?? "unknown"})`,
        priority: "medium",
        tags: ["github-issue", `gh-${issue.number}`],
      })
      .returning();

    broadcast({
      type: "task:created",
      data: task,
      timestamp: new Date().toISOString(),
    });
  }

  if (payload.action === "closed") {
    const issue = payload.issue;
    const tag = `gh-${issue.number}`;

    // Find task with matching GitHub tag
    const allTasks = await db.select().from(tasks);
    const linkedTask = allTasks.find(
      (t) => t.tags?.includes(tag) || t.title.includes(`[GH#${issue.number}]`)
    );

    if (linkedTask && linkedTask.status !== "completed") {
      await db
        .update(tasks)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(tasks.id, linkedTask.id));

      broadcast({
        type: "task:updated",
        data: { ...linkedTask, status: "completed" },
        timestamp: new Date().toISOString(),
      });
    }
  }
}

async function handlePushEvent(payload: any) {
  const repoUrl = payload.repository?.html_url;
  const allProjects = await db.select().from(projects);
  const project = allProjects.find(
    (p) => p.githubRepo === repoUrl || p.githubRepo === `${repoUrl}.git`
  );

  const commits = payload.commits ?? [];
  if (commits.length === 0) return;

  const commitSummary = commits
    .slice(0, 5)
    .map((c: any) => `• ${c.message.split("\n")[0]}`)
    .join("\n");

  await db.insert(activityEvents).values({
    actorType: "ceo",
    actorId: "github",
    actorName: payload.pusher?.name ?? "GitHub",
    eventType: "commit",
    title: `${commits.length} commit(s) pushed`,
    description: commitSummary,
    projectId: project?.id ?? null,
    metadata: {
      ref: payload.ref,
      commits: commits.slice(0, 5).map((c: any) => ({
        sha: c.id?.substring(0, 7),
        message: c.message?.substring(0, 200),
        author: c.author?.name,
      })),
    },
  });
}

async function handlePullRequestEvent(payload: any) {
  const action = payload.action;
  if (!["opened", "closed"].includes(action)) return;

  const pr = payload.pull_request;
  const repoUrl = payload.repository?.html_url;
  const allProjects = await db.select().from(projects);
  const project = allProjects.find(
    (p) => p.githubRepo === repoUrl || p.githubRepo === `${repoUrl}.git`
  );

  const isMerged = action === "closed" && pr.merged;
  const eventTitle = isMerged
    ? `PR #${pr.number} merged: ${pr.title}`
    : action === "opened"
      ? `PR #${pr.number} opened: ${pr.title}`
      : `PR #${pr.number} closed: ${pr.title}`;

  await db.insert(activityEvents).values({
    actorType: "ceo",
    actorId: "github",
    actorName: pr.user?.login ?? "GitHub",
    eventType: "review",
    title: eventTitle,
    description: pr.body?.substring(0, 500) ?? "",
    projectId: project?.id ?? null,
    metadata: {
      prNumber: pr.number,
      prUrl: pr.html_url,
      action,
      merged: isMerged,
    },
  });
}

// ─── GitHub API Proxy ─────────────────────────────────

// GET /api/github/projects/:id/activity — fetch GitHub activity for a project
app.get("/projects/:id/activity", async (c) => {
  const projectId = c.req.param("id");
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return c.json({ error: "GITHUB_TOKEN not configured" }, 500);
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  if (!project.githubRepo) {
    return c.json({ error: "No GitHub repo linked" }, 400);
  }

  // Parse owner/repo from URL
  const match = project.githubRepo.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!match) {
    return c.json({ error: "Invalid GitHub repo URL" }, 400);
  }

  const [, owner, repo] = match;

  try {
    const octokit = new Octokit({ auth: token });

    const [commitsRes, issuesRes, pullsRes] = await Promise.all([
      octokit.repos.listCommits({ owner, repo, per_page: 10 }).catch(() => ({ data: [] })),
      octokit.issues.listForRepo({ owner, repo, state: "open", per_page: 10 }).catch(() => ({ data: [] })),
      octokit.pulls.list({ owner, repo, state: "open", per_page: 10 }).catch(() => ({ data: [] })),
    ]);

    return c.json({
      commits: commitsRes.data.map((c: any) => ({
        sha: c.sha?.substring(0, 7),
        message: c.commit?.message?.split("\n")[0] ?? "",
        author: c.commit?.author?.name ?? c.author?.login ?? "unknown",
        date: c.commit?.author?.date ?? "",
        url: c.html_url,
      })),
      issues: issuesRes.data
        .filter((i: any) => !i.pull_request) // Exclude PRs from issues
        .map((i: any) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          createdAt: i.created_at,
          url: i.html_url,
        })),
      pullRequests: pullsRes.data.map((p: any) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        createdAt: p.created_at,
        url: p.html_url,
        draft: p.draft ?? false,
      })),
    });
  } catch (err) {
    return c.json({ error: "Failed to fetch GitHub data", detail: err instanceof Error ? err.message : "unknown" }, 500);
  }
});

export default app;
