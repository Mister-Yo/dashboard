"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ErrorStateProps {
  message?: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  message = "Something went wrong",
  detail,
  onRetry,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-6" : "py-16",
        className
      )}
    >
      <span
        className={cn("mb-3", compact ? "text-2xl" : "text-4xl")}
        role="img"
        aria-hidden
      >
        ⚠️
      </span>
      <h3
        className={cn(
          "font-semibold text-[var(--danger)]",
          compact ? "text-sm" : "text-base"
        )}
      >
        {message}
      </h3>
      {detail && (
        <p
          className={cn(
            "text-[var(--muted)] mt-1 max-w-sm",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {detail}
        </p>
      )}
      {onRetry && (
        <Button onClick={onRetry} className="mt-4">
          Retry
        </Button>
      )}
    </div>
  );
}
