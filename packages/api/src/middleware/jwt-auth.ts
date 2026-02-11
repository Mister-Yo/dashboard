import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";

export interface JwtUser {
  id: string;
  name: string;
  role: string;
}

declare module "hono" {
  interface ContextVariableMap {
    jwtUser: JwtUser | null;
  }
}

const JWT_SECRET_KEY = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
};

/**
 * Optional JWT auth middleware — sets jwtUser if valid JWT provided.
 * Skips tokens starting with "ak_" (those are API keys handled by apiKeyAuth).
 * Allows unauthenticated requests through.
 */
export const jwtAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ") || authHeader.includes("ak_")) {
    c.set("jwtUser", null);
    await next();
    return;
  }

  const token = authHeader.replace("Bearer ", "");
  const key = JWT_SECRET_KEY();

  if (!key) {
    c.set("jwtUser", null);
    await next();
    return;
  }

  try {
    const { payload } = await jwtVerify(token, key);
    c.set("jwtUser", {
      id: payload.sub as string,
      name: payload.name as string,
      role: payload.role as string,
    });
  } catch {
    // Invalid JWT — treat as unauthenticated (don't block)
    c.set("jwtUser", null);
  }

  await next();
});

/**
 * Strict JWT middleware — requires valid JWT.
 */
export const requireJwt = createMiddleware(async (c, next) => {
  const user = c.get("jwtUser");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }
  await next();
});
