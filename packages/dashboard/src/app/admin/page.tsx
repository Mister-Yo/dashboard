"use client";

import { useState } from "react";
import {
  useEmployees,
  useApproveEmployee,
  useRejectEmployee,
  useUpdateEmployee,
} from "@/hooks/use-api";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function AdminPage() {
  const { data: employees = [], isLoading, error, refetch } = useEmployees();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const approve = useApproveEmployee();
  const reject = useRejectEmployee();
  const deactivate = useUpdateEmployee();

  function handleReject() {
    if (!rejectTarget) return;
    reject.mutate(rejectTarget, {
      onSuccess: () => setRejectTarget(null),
    });
  }

  const pending = employees.filter((e) => e.status === "pending");
  const active = employees.filter((e) => e.status === "active");
  const inactive = employees.filter((e) => e.status === "inactive");

  const actionPending = approve.isPending || reject.isPending || deactivate.isPending;

  if (isLoading) {
    return (
      <FadeIn>
        <PageHeader label="System" title="Admin" />
        <SkeletonGrid count={6} />
      </FadeIn>
    );
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load data"
        detail={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <FadeIn>
      <PageHeader
        label="System"
        title="User Management"
        description="Approve registrations and manage employee access"
        stats={[
          ...(pending.length > 0
            ? [{ label: "pending", value: pending.length, color: "warning" as const }]
            : []),
          { label: "active", value: active.length, color: "success" as const },
          ...(inactive.length > 0
            ? [{ label: "inactive", value: inactive.length, color: "muted" as const }]
            : []),
        ]}
      />

      <div className="space-y-8">
        {/* Pending */}
        {pending.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" aria-hidden />
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
                      onClick={() => approve.mutate(emp.id)}
                      disabled={actionPending}
                      className="flex-1 text-xs"
                    >
                      {approve.isPending ? "..." : "Approve"}
                    </Button>
                    <button
                      onClick={() => setRejectTarget(emp.id)}
                      disabled={actionPending}
                      className="flex-1 rounded-full border border-red-500/30 text-red-400 text-xs py-2 hover:bg-red-500/10 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <EmptyState icon="✓" title="No pending registrations" compact />
        )}

        {/* Active */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Active Employees</h2>
          {active.length === 0 ? (
            <EmptyState icon="👤" title="No active employees" compact />
          ) : (
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
                    onClick={() => deactivate.mutate({ id: emp.id, status: "inactive" })}
                    disabled={actionPending}
                    className="w-full rounded-full border border-[var(--card-border)] text-[var(--muted)] text-xs py-1.5 hover:bg-white/5 hover:text-red-400 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                  >
                    Deactivate
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Inactive */}
        {inactive.length > 0 && (
          <section className="opacity-70">
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
                    onClick={() => approve.mutate(emp.id)}
                    disabled={actionPending}
                    className="w-full rounded-full border border-[var(--card-border)] text-[var(--muted)] text-xs py-1.5 hover:bg-white/5 hover:text-emerald-400 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                  >
                    Re-activate
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Reject confirmation dialog */}
      <ConfirmDialog
        open={rejectTarget !== null}
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
        title="Reject Registration"
        description="This will permanently delete this registration request. This action cannot be undone."
        confirmLabel="Reject"
        variant="danger"
        loading={reject.isPending}
      />
    </FadeIn>
  );
}
