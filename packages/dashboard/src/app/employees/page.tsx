"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
  telegramUsername: string | null;
  email: string | null;
  assignedProjectIds: string[];
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Employee[]>("/api/employees");
        setEmployees(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load employees");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const summary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const pending = employees.filter((e) => e.status === "pending").length;
    return { total, active, pending };
  }, [employees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading employees...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to connect to API</p>
          <p className="text-[var(--muted)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Employees
          </p>
          <h1 className="text-3xl font-semibold">Human Team</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Track employees, their current status, and project assignments.
            New employees register via <a href="/login" className="underline text-[var(--accent)]">/login</a> and are approved on <a href="/admin" className="underline text-[var(--accent)]">/admin</a>.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summary.total} total
          </span>
          <span className="rounded-full border border-emerald-400/30 text-emerald-400 bg-emerald-400/10 px-3 py-1">
            {summary.active} active
          </span>
          {summary.pending > 0 && (
            <span className="rounded-full border border-amber-400/30 text-amber-400 bg-amber-400/10 px-3 py-1">
              {summary.pending} pending
            </span>
          )}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Employee
                </p>
                <h3 className="text-lg font-semibold">{employee.name}</h3>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {employee.role}
                </p>
              </div>
              <StatusPill status={employee.status} />
            </div>

            <div className="mt-4 space-y-2 text-xs text-[var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Telegram</span>
                <span className="text-[var(--foreground)]">
                  {employee.telegramUsername ?? "\u2014"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Email</span>
                <span className="text-[var(--foreground)]">
                  {employee.email ?? "\u2014"}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
              <p className="text-[var(--muted)]">Assigned projects</p>
              <p className="text-sm font-medium">
                {employee.assignedProjectIds?.length ?? 0}
              </p>
            </div>
          </div>
        ))}

        {employees.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-[var(--muted)]">
            No employees registered yet.
          </div>
        )}
      </section>
    </div>
  );
}
