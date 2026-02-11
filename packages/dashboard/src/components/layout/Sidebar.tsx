"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface EmployeeInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Command",
    items: [
      { href: "/", label: "Board", icon: "◉" },
      { href: "/activity", label: "Activity", icon: "◎" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/projects", label: "Projects", icon: "⌂" },
      { href: "/tasks", label: "Tasks", icon: "✓" },
      { href: "/agents", label: "Agents", icon: "◈" },
      { href: "/employees", label: "Employees", icon: "◇" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/coordination", label: "Coordination", icon: "✶" },
      { href: "/knowledge", label: "Knowledge", icon: "▦" },
      { href: "/analytics", label: "Analytics", icon: "△" },
      { href: "/controller", label: "AI Controller", icon: "▣" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/structure", label: "Structure", icon: "⌇" },
      { href: "/admin", label: "Admin", icon: "⊞" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<EmployeeInfo | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("employee_info");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  function handleLogout() {
    localStorage.removeItem("employee_token");
    localStorage.removeItem("employee_info");
    localStorage.removeItem("agent_api_key");
    setUser(null);
    window.location.href = "/login";
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-50 lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--card-border)] text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
        aria-label="Toggle menu"
      >
        <span className="text-lg">{open ? "✕" : "☰"}</span>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-56 border-r border-[var(--card-border)] bg-[var(--surface)] flex flex-col",
          "transition-transform duration-200 ease-in-out",
          "lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[var(--card-border)]">
          <h1 className="text-base font-semibold tracking-wide">AI Command</h1>
          <p className="text-[10px] text-[var(--muted)] tracking-wider uppercase">
            Dashboard
          </p>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navGroups.map((group, gi) => (
            <div key={group.title} className={cn(gi > 0 && "mt-2")}>
              <p className="px-4 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] font-medium">
                {group.title}
              </p>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 mx-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors",
                      active
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium"
                        : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5"
                    )}
                  >
                    <span className="text-[11px] w-4 text-center shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Auth section */}
        <div className="p-3 border-t border-[var(--card-border)]">
          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-[10px] font-semibold shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-[var(--muted)] truncate">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-[10px] text-[var(--muted)] hover:text-red-400 transition-colors px-1 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded"
                title="Logout"
              >
                ←
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
            >
              <span className="text-[10px]">→</span>
              <span>Login</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
