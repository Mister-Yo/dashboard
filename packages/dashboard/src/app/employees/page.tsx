"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    return { total, active };
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

  async function handleCreate() {
    setSubmitting(true);
    setFormError(null);
    setApiKey(null);
    setCopied(false);
    try {
      const created = await apiFetch<Employee>("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          name,
          role,
          email: email || null,
          telegramUsername: telegram || null,
        }),
      });
      setEmployees((prev) => [created, ...prev]);

      const keyResult = await apiFetch<{ apiKey: string }>(
        `/api/employees/${created.id}/api-key`,
        { method: "POST" }
      );
      setApiKey(keyResult.apiKey);
      void logActivity({
        event_type: "note",
        title: `Employee created: ${created.name}`,
        description: `role=${created.role}`,
        metadata: {
          employeeId: created.id,
          role: created.role,
          email: created.email,
          telegramUsername: created.telegramUsername,
        },
      });

      setName("");
      setRole("");
      setEmail("");
      setTelegram("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summary.total} total
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summary.active} active
          </span>
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Create
            </p>
            <h2 className="text-lg font-semibold">New Employee</h2>
          </div>
          <Button onClick={handleCreate} disabled={submitting || !name || !role}>
            {submitting ? "Creating..." : "Create employee"}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder="Role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
          <Input
            placeholder="Email (optional)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            placeholder="Telegram username (optional)"
            value={telegram}
            onChange={(event) => setTelegram(event.target.value)}
          />
        </div>
        {apiKey && (
          <div className="mt-4 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              API Key (show once)
            </p>
            <p className="text-sm mt-2 break-all">{apiKey}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={handleCopy} className="px-3 py-1 text-xs">
                {copied ? "Copied" : "Copy key"}
              </Button>
              <span className="text-xs text-[var(--muted)]">
                Save now. It will not be shown again.
              </span>
            </div>
          </div>
        )}
        {formError && (
          <p className="mt-3 text-sm text-red-400">{formError}</p>
        )}
      </section>

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
                  {employee.telegramUsername ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Email</span>
                <span className="text-[var(--foreground)]">
                  {employee.email ?? "—"}
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
