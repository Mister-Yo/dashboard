const COORD_API_URL =
  process.env.NEXT_PUBLIC_COORD_API_URL ?? "http://134.209.162.250";

export async function coordFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${COORD_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error ?? `API error: ${res.status}`);
  }

  return res.json();
}
