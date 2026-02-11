import { createMiddleware } from "hono/factory";
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { apiKeys } from "../db/schema";

export interface ApiKeyOwner {
  type: "agent" | "employee";
  id: string;
  scopes: string[];
}

declare module "hono" {
  interface ContextVariableMap {
    apiKeyOwner: ApiKeyOwner | null;
  }
}

/**
 * Optional auth middleware — sets apiKeyOwner if valid key provided,
 * allows unauthenticated requests through (for dashboard frontend).
 * Use requireAuth() middleware for endpoints that MUST be authenticated.
 */
export const apiKeyAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ak_")) {
    // No API key — allow through but set owner to null
    c.set("apiKeyOwner", null);
    await next();
    return;
  }

  const rawKey = authHeader.replace("Bearer ", "");
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const [record] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.isRevoked, false)));

  if (!record) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    return c.json({ error: "API key expired" }, 401);
  }

  // Update last used timestamp
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.id));

  c.set("apiKeyOwner", {
    type: record.ownerType,
    id: record.ownerId,
    scopes: (record.scopes ?? []) as string[],
  });

  await next();
});

/**
 * Strict auth middleware — requires valid API key.
 * Use after apiKeyAuth on endpoints that need authentication.
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const owner = c.get("apiKeyOwner");
  if (!owner) {
    return c.json({ error: "Authentication required. Provide API key via Authorization: Bearer ak_..." }, 401);
  }
  await next();
});
