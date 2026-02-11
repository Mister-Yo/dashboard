"use client";

import { useMemo } from "react";
import { useEmployees } from "@/hooks/use-api";
import { StatusPill } from "@/components/ui/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, FadeInStagger, FadeInItem } from "@/components/ui/fade-in";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

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
  const { data: employees = [], isLoading: loading, error: empError, refetch } = useEmployees();

  const summary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const pending = employees.filter((e) => e.status === "pending").length;
    return { total, active, pending };
  }, [employees]);

  if (loading) {
    return (
      <FadeIn>
        <PageHeader label="Employees" title="Human Team" />
        <SkeletonGrid count={6} />
      </FadeIn>
    );
  }

  if (empError) {
    return (
      <ErrorState
        message="Failed to connect to API"
        detail={empError?.message}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <FadeIn>
      <div className="space-y-8">
        <PageHeader
          label="Employees"
          title="Human Team"
          description="Track employees, their current status, and project assignments."
          stats={[
            { label: "total", value: summary.total, color: "muted" as const },
            { label: "active", value: summary.active, color: "success" as const },
            ...(summary.pending > 0
              ? [{ label: "pending", value: summary.pending, color: "warning" as const }]
              : []),
          ]}
        />

        <FadeInStagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => (
            <FadeInItem key={employee.id}>
              <div
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
            </FadeInItem>
          ))}

          {employees.length === 0 && (
            <EmptyState
              icon="👤"
              title="No employees registered yet"
              description="Employees register via /login and are approved on /admin."
            />
          )}
        </FadeInStagger>
      </div>
    </FadeIn>
  );
}
