"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Stat {
  label: string;
  value: number | string;
  color?: "success" | "warning" | "danger" | "primary" | "muted";
}

const statColors: Record<string, string> = {
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-rose-400",
  primary: "text-[var(--primary)]",
  muted: "text-[var(--muted)]",
};

interface PageHeaderProps {
  label: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  stats?: Stat[];
  className?: string;
}

export function PageHeader({
  label,
  title,
  description,
  actions,
  stats,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] mb-1">
            {label}
          </p>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[var(--muted)] mt-1 max-w-xl">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--surface)] px-3 py-1.5"
            >
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  statColors[stat.color ?? "muted"]
                )}
              >
                {stat.value}
              </span>
              <span className="text-xs text-[var(--muted)]">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
