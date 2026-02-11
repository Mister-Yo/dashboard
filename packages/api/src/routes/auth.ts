import { Hono } from "hono";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { employees } from "../db/schema";

const app = new Hono();

const JWT_SECRET_KEY = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is required");
  return new TextEncoder().encode(secret);
};

// POST /api/auth/github — exchange GitHub OAuth code for JWT
app.post("/github", async (c) => {
  const { code } = await c.req.json<{ code: string }>();

  if (!code) {
    return c.json({ error: "code is required" }, 400);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.json({ error: "GitHub OAuth not configured" }, 500);
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      return c.json({ error: tokenData.error ?? "Failed to get access token" }, 401);
    }

    // 2. Fetch GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser = await userRes.json() as {
      id: number;
      login: string;
      name: string | null;
      email: string | null;
      avatar_url: string;
    };

    // 3. Fetch email if not public
    let userEmail = githubUser.email;
    if (!userEmail) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailsRes.json() as { email: string; primary: boolean; verified: boolean }[];
      const primary = emails.find((e) => e.primary && e.verified);
      userEmail = primary?.email ?? emails[0]?.email ?? null;
    }

    const githubId = String(githubUser.id);
    const displayName = githubUser.name ?? githubUser.login;

    // 4. Find or create employee
    let [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.githubId, githubId));

    if (!employee && userEmail) {
      [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.email, userEmail));

      // Link existing employee to GitHub
      if (employee) {
        await db
          .update(employees)
          .set({ githubId, avatarUrl: githubUser.avatar_url })
          .where(eq(employees.id, employee.id));
      }
    }

    if (!employee) {
      // Auto-create as CEO (first GitHub login) or employee
      [employee] = await db
        .insert(employees)
        .values({
          name: displayName,
          email: userEmail ?? `${githubUser.login}@github`,
          role: "ceo",
          status: "active",
          githubId,
          avatarUrl: githubUser.avatar_url,
        })
        .returning();
    }

    if (employee.status !== "active") {
      return c.json({ error: "Account is not active. Contact CEO for approval." }, 403);
    }

    // 5. Sign JWT
    const jwt = await new SignJWT({
      sub: employee.id,
      name: employee.name,
      role: employee.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET_KEY());

    return c.json({
      token: jwt,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        avatarUrl: employee.avatarUrl,
      },
    });
  } catch (err) {
    return c.json({ error: "OAuth failed", detail: err instanceof Error ? err.message : "unknown" }, 500);
  }
});

export default app;
