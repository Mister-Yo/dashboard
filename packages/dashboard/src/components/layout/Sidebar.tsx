"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Board", icon: "\u25FB" },
  { href: "/activity", label: "Activity", icon: "\u25C9" },
  { href: "/coordination", label: "Coordination", icon: "\u2736" },
  { href: "/projects", label: "Projects", icon: "\u2302" },
  { href: "/agents", label: "Agents", icon: "\u25CE" },
  { href: "/employees", label: "Employees", icon: "\u25C8" },
  { href: "/structure", label: "Structure", icon: "\u2387" },
  { href: "/tasks", label: "Tasks", icon: "\u2713" },
  { href: "/knowledge", label: "Knowledge", icon: "\u25A6" },
  { href: "/controller", label: "AI Controller", icon: "\u25A3" },
  { href: "/admin", label: "Admin", icon: "\u2B21" },
  { href: "/login", label: "Login", icon: "\u2192" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-50 lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--card-border)] text-[var(--foreground)]"
        aria-label="Toggle menu"
      >
        <span className="text-lg">{open ? "\u2715" : "\u2630"}</span>
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
        className={`
          fixed top-0 left-0 z-40 h-full w-60 border-r border-[var(--card-border)] bg-[var(--surface)] flex flex-col
          transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-5 border-b border-[var(--card-border)]">
          <h1 className="text-lg font-semibold tracking-wide">AI Command</h1>
          <p className="text-xs text-[var(--muted)]">Company + Agent Ops</p>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm mb-1 transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5"
                }`}
              >
                <span className="text-xs">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
