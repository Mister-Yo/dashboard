"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";

interface Employee {
  id: string;
  name: string;
  role: string;
  email: string | null;
  telegramUsername: string | null;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await apiFetch<Employee[]>("/api/employees");
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      await apiFetch(`/api/employees/${id}/approve`, { method: "POST" });
      await loadEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    if (!confirm("Reject and delete this registration?")) return;
    setActionLoading(id);
    try {
      await apiFetch(`/api/employees/${id}/reject`, { method: "POST" });
      await loadEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeactivate(id: string) {
    setActionLoading(id);
    try {
      await apiFetch(`/api/employees/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "inactive" }),
      });
      await loadEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleActivate(id: string) {
    setActionLoading(id);
    try {
      await apiFetch(`/api/employees/${id}/approve`, { method: "POST" });
      await loadEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to activate");
    } finally {
      setActionLoading(null);
    }
  }

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
          <p className="text-red-400 mb-2">Failed to load data</p>
          <p className="text-[var(--muted)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const pending = employees.filter((e) => e.status === "pending");
  const active = employees.filter((e) => e.status === "active");
  const inactive = employees.filter((e) => e.status === "inactive");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Admin
          </p>
          <h1 className="text-3xl font-semibold">User Management</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Approve new registrations, manage employee access.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {pending.length > 0 && (
            <span className="rounded-full border border-amber-400/30 text-amber-400 bg-amber-400/10 px-3 py-1 font-medium">
              {pending.length} pending
            </span>
          )}
          <span className="rounded-full border border-emerald-400/30 text-emerald-400 bg-emerald-400/10 px-3 py-1">
            {active.length} active
          </span>
          {inactive.length > 0 && (
            <span className="rounded-full border border-[var(--card-border)] text-[var(--muted)] px-3 py-1">
              {inactive.length} inactive
            </span>
          )}
        </div>
      </header>

      {/* Pending Registrations */}
      {pending.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-lg font-semibold">Pending Approval</h2>
            <span className="text-xs text-[var(--muted)]">({pending.length})</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((emp) => (
              <div
                key={emp.id}
                className="rounded-2xl border border-amber-400/20 bg-[var(--card)] p-4 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 to-amber-600" />
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{emp.name}</h3>
                    <p className="text-xs text-[var(--muted)]">{emp.email}</p>
                  </div>
                  <StatusPill status="pending" />
                </div>
                <div className="space-y-1.5 text-xs text-[var(--muted)] mb-4">
                  <div className="flex justify-between">
                    <span>Role</span>
                    <span className="text-[var(--foreground)]">{emp.role}</span>
                  </div>
                  {emp.telegramUsername && (
                    <div className="flex justify-between">
                      <span>Telegram</span>
                      <span className="text-[var(--foreground)]">@{emp.telegramUsername}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Registered</span>
                    <span className="text-[var(--foreground)]">
                      {new Date(emp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(emp.id)}
                    disabled={actionLoading === emp.id}
                    className="flex-1 text-xs"
                  >
                    {actionLoading === emp.id ? "..." : "Approve"}
                  </Button>
                  <button
                    onClick={() => handleReject(emp.id)}
                    disabled={actionLoading === emp.id}
                    className="flex-1 rounded-xl border border-red-500/30 text-red-400 text-xs py-2 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* No pending */}
      {pending.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-6 text-center">
          <p className="text-2xl mb-2 opacity-30">&#10003;</p>
          <p className="text-sm text-[var(--muted)]">No pending registrations</p>
        </div>
      )}

      {/* Active Employees */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Active Employees</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((emp) => (
            <div
              key={emp.id}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-base font-semibold">{emp.name}</h3>
                  <p className="text-xs text-[var(--muted)]">{emp.email ?? "No email"}</p>
                </div>
                <StatusPill status="active" />
              </div>
              <div className="flex justify-between text-xs text-[var(--muted)] mb-3">
                <span>Role</span>
                <span className="text-[var(--foreground)]">{emp.role}</span>
              </div>
              <button
                onClick={() => handleDeactivate(emp.id)}
                disabled={actionLoading === emp.id}
                className="w-full rounded-xl border border-[var(--card-border)] text-[var(--muted)] text-xs py-1.5 hover:bg-white/5 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                Deactivate
              </button>
            </div>
          ))}
          {active.length === 0 && (
            <p className="col-span-full text-sm text-[var(--muted)] text-center py-4">
              No active employees
            </p>
          )}
        </div>
      </section>

      {/* Inactive Employees */}
      {inactive.length > 0 && (
        <section className="opacity-60">
          <h2 className="text-lg font-semibold mb-4">Inactive</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {inactive.map((emp) => (
              <div
                key={emp.id}
                className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-base font-semibold">{emp.name}</h3>
                    <p className="text-xs text-[var(--muted)]">{emp.email ?? "No email"}</p>
                  </div>
                  <StatusPill status="inactive" />
                </div>
                <button
                  onClick={() => handleActivate(emp.id)}
                  disabled={actionLoading === emp.id}
                  className="w-full rounded-xl border border-[var(--card-border)] text-[var(--muted)] text-xs py-1.5 hover:bg-white/5 hover:text-emerald-400 transition-colors disabled:opacity-50"
                >
                  Re-activate
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
