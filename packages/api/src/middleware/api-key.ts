import { createMiddleware } from "hono/factory";
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { apiKeys } from "../db/schema";
import type { ApiKeyOwner } from "@dashboard/shared";

declare module "hono" {
  interface ContextVariableMap {
    apiKeyOwner: ApiKeyOwner;
  }
}

export const apiKeyAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ak_")) {
    return c.json({ error: "Missing or invalid API key" }, 401);
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
    scopes: record.scopes ?? [],
  });

  await next();
});
