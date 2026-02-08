"use client";

import { cn } from "@/lib/utils";

const statusTone: Record<
  string,
  { label: string; dot: string; text: string; bg: string }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-400",
    text: "text-emerald-200",
    bg: "bg-emerald-500/10",
  },
  working: {
    label: "Working",
    dot: "bg-cyan-400",
    text: "text-cyan-200",
    bg: "bg-cyan-500/10",
  },
  idle: {
    label: "Idle",
    dot: "bg-amber-300",
    text: "text-amber-200",
    bg: "bg-amber-500/10",
  },
  blocked: {
    label: "Blocked",
    dot: "bg-rose-400",
    text: "text-rose-200",
    bg: "bg-rose-500/10",
  },
  paused: {
    label: "Paused",
    dot: "bg-amber-300",
    text: "text-amber-200",
    bg: "bg-amber-500/10",
  },
  completed: {
    label: "Done",
    dot: "bg-emerald-400",
    text: "text-emerald-200",
    bg: "bg-emerald-500/10",
  },
  error: {
    label: "Error",
    dot: "bg-rose-400",
    text: "text-rose-200",
    bg: "bg-rose-500/10",
  },
  inactive: {
    label: "Inactive",
    dot: "bg-slate-500",
    text: "text-slate-300",
    bg: "bg-slate-500/10",
  },
};

export function StatusPill({ status }: { status: string }) {
  const tone = statusTone[status] ?? {
    label: status || "Unknown",
    dot: "bg-slate-500",
    text: "text-slate-300",
    bg: "bg-slate-500/10",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-3 py-1 text-xs",
        tone.text,
        tone.bg
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
      {tone.label}
    </span>
  );
}
