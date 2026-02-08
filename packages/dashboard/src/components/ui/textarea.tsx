"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-2xl border border-[var(--card-border)]",
        "bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)]",
        "placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
        className
      )}
      {...props}
    />
  );
}
