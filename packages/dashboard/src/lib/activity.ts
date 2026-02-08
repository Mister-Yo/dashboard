"use client";

import { apiFetch } from "@/lib/api";
import { coordFetch, getCoordToken } from "@/lib/coord";

type ActorType = "agent" | "employee" | "ceo";
type ActivityEventType =
  | "start_task"
  | "finish_task"
  | "status_change"
  | "note"
  | "blocker"
  | "deploy"
  | "commit"
  | "review";

interface AuthContext {
  type: "api_key" | "jwt" | "anonymous";
  owner_type?: string;
  owner_id?: string;
  name?: string;
  role?: string;
}

let cachedToken: string | null | undefined;
let cachedAuth: AuthContext | null | undefined;
let inflight: Promise<AuthContext | null> | null = null;

async function getAuthCached(): Promise<AuthContext | null> {
  const token = getCoordToken();

  // If token changes (login/logout), bust cache.
  if (cachedToken !== token) {
    cachedToken = token;
    cachedAuth = undefined;
    inflight = null;
  }

  if (cachedAuth !== undefined) return cachedAuth;
  if (!token) {
    cachedAuth = null;
    return null;
  }

  if (!inflight) {
    inflight = coordFetch<AuthContext>("/api/coord/auth/me")
      .then((data) => {
        cachedAuth = data;
        return data;
      })
      .catch(() => {
        cachedAuth = null;
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

function mapActor(auth: AuthContext | null): {
  actor_type: ActorType;
  actor_id: string;
  actor_name: string;
} {
  if (!auth) return { actor_type: "ceo", actor_id: "ceo", actor_name: "CEO" };

  if (auth.owner_type === "agent") {
    return {
      actor_type: "agent",
      actor_id: auth.owner_id ?? "unknown-agent",
      actor_name: auth.name ?? auth.owner_id ?? "Agent",
    };
  }

  if (auth.owner_type === "user") {
    const type: ActorType = auth.role === "ceo" ? "ceo" : "employee";
    return {
      actor_type: type,
      actor_id: auth.owner_id ?? "unknown-user",
      actor_name: auth.name ?? auth.owner_id ?? "User",
    };
  }

  return { actor_type: "ceo", actor_id: "ceo", actor_name: "CEO" };
}

export async function logActivity(input: {
  event_type: ActivityEventType;
  title: string;
  description?: string;
  project_id?: string | null;
  task_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const auth = await getAuthCached();
    const actor = mapActor(auth);
    await apiFetch("/api/activity", {
      method: "POST",
      body: JSON.stringify({
        ...actor,
        event_type: input.event_type,
        title: input.title,
        description: input.description ?? "",
        project_id: input.project_id ?? null,
        task_id: input.task_id ?? null,
        metadata: input.metadata ?? {},
      }),
    });
  } catch {
    // Best-effort logging: never break primary UX.
  }
}

