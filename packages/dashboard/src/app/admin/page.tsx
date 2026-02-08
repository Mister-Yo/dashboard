"use client";

import { useEffect, useState } from "react";
import { coordFetch } from "@/lib/coord";
import { StatusPill } from "@/components/ui/status-pill";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await coordFetch<User[]>("/api/coord/users");
        setUsers(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load pending activations"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading admin panel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2">Admin access required</p>
          <p className="text-[var(--muted)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const pending = users.filter((u) => u.status !== "active");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Admin
          </p>
          <h1 className="text-3xl font-semibold">Pending Activations</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Review users waiting for approval or activation.
          </p>
        </div>
        <div className="text-xs text-[var(--muted)]">
          {pending.length} pending / {users.length} total
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  User
                </p>
                <h3 className="text-lg font-semibold">{user.name}</h3>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {user.email}
                </p>
              </div>
              <StatusPill status={user.status} />
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              Role: {user.role}
            </p>
          </div>
        ))}

        {users.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-[var(--muted)]">
            No users found.
          </div>
        )}
      </section>
    </div>
  );
}
