import { apiFetch } from "./api";

/**
 * Coordinator API client — delegates to the main apiFetch.
 * The coordinator is now part of the main Hono API at /api/coord/*.
 */
export async function coordFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(path, options);
}
