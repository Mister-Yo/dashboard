const DEFAULT_DEV_COORD_URL = "http://localhost:8787";

const COORD_API_URL =
  process.env.NEXT_PUBLIC_COORD_API_URL ??
  (process.env.NODE_ENV === "development" ? DEFAULT_DEV_COORD_URL : "");

function joinUrl(base: string, path: string) {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) {
    return `${base.slice(0, -1)}${path}`;
  }
  return `${base}${path}`;
}

const TOKEN_KEY = "coord_token";

export function getCoordToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setCoordToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearCoordToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

type CoordFetchOptions = RequestInit & { auth?: boolean };

export async function coordFetch<T>(
  path: string,
  options?: CoordFetchOptions
): Promise<T> {
  const shouldAuth = options?.auth !== false;
  const token = shouldAuth ? getCoordToken() : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(joinUrl(COORD_API_URL, path), {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error ?? `API error: ${res.status}`);
  }

  return res.json();
}
