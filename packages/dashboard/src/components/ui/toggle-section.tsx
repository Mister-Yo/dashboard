import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ToggleSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  buttonText?: string;
  icon?: string;
  className?: string;
}

export function ToggleSection({ 
  title, 
  description, 
  children, 
  defaultOpen = false,
  buttonText = "Create",
  icon = "+",
  className 
}: ToggleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("rounded-2xl border border-[var(--card-border)] bg-[var(--surface)]", className)}>
      <div className="flex items-center justify-between p-5 border-b border-[var(--card-border)]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-1">
            {title}
          </p>
          {description && (
            <p className="text-sm text-[var(--muted)]">{description}</p>
          )}
        </div>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "transition-all duration-200",
            isOpen && "bg-[var(--accent-strong)] rotate-45"
          )}
        >
          <span className="text-lg">{icon}</span>
          <span className="ml-2">{isOpen ? "Cancel" : buttonText}</span>
        </Button>
      </div>
      
      {isOpen && (
        <div className="p-5">
          {children}
        </div>
      )}
    </div>
  );
}