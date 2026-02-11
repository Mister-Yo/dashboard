"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labelMap: Record<string, string> = {
  "": "Board",
  agents: "Agents",
  tasks: "Tasks",
  projects: "Projects",
  employees: "Employees",
  coordination: "Coordination",
  knowledge: "Knowledge",
  analytics: "Analytics",
  controller: "AI Controller",
  structure: "Structure",
  admin: "Admin",
  activity: "Activity",
  login: "Login",
  chat: "Chat",
  callback: "Callback",
};

export function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = labelMap[seg] ?? decodeURIComponent(seg).slice(0, 20);
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav
      className="flex items-center gap-1.5 text-xs text-[var(--muted)] mb-4"
      aria-label="Breadcrumb"
    >
      <Link
        href="/"
        className="hover:text-[var(--foreground)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded"
      >
        Board
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <span className="text-[var(--card-border)]">/</span>
          {crumb.isLast ? (
            <span className="text-[var(--foreground)]">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-[var(--foreground)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
