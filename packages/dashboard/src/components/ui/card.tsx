import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover = true, glow = false, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4",
        hover && "transition-all duration-200 hover:border-[var(--accent)]/50",
        glow && "hover:shadow-lg hover:shadow-[var(--accent)]/20",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 mb-4", className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function CardTitle({ children, className, label }: CardTitleProps) {
  return (
    <div className={className}>
      {label && (
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-1">
          {label}
        </p>
      )}
      <h3 className="text-lg font-semibold">{children}</h3>
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn("mt-4 pt-3 border-t border-[var(--card-border)]", className)}>
      {children}
    </div>
  );
}

interface CardStatProps {
  label: string;
  value: string | number;
  className?: string;
}

export function CardStat({ label, value, className }: CardStatProps) {
  return (
    <div className={cn("flex items-center justify-between text-xs", className)}>
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-[var(--foreground)] font-medium">{value}</span>
    </div>
  );
}