"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-16",
        className
      )}
    >
      <span className={cn("mb-3", compact ? "text-3xl" : "text-4xl")} role="img" aria-hidden>
        {icon}
      </span>
      <h3
        className={cn(
          "font-semibold text-[var(--foreground)]",
          compact ? "text-sm" : "text-base"
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-[var(--muted)] mt-1 max-w-xs",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
