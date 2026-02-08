import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { apiKeys } from "../db/schema";
import type { ApiKeyOwnerType, GeneratedApiKey } from "@dashboard/shared";

export async function generateApiKey(
  ownerType: ApiKeyOwnerType,
  ownerId: string,
  scopes: string[] = []
): Promise<GeneratedApiKey> {
  const raw = `ak_${ownerType}_${randomBytes(32).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.substring(0, 16);

  await db.insert(apiKeys).values({
    ownerType,
    ownerId,
    keyHash: hash,
    keyPrefix: prefix,
    scopes,
  });

  return { key: raw, prefix };
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({ isRevoked: true })
    .where(eq(apiKeys.id, keyId));

  return true;
}
