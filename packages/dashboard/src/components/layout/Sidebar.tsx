"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Board", icon: "◻" },
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/agents", label: "Agents", icon: "🤖" },
  { href: "/employees", label: "Employees", icon: "👤" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/knowledge", label: "Knowledge", icon: "📚" },
  { href: "/controller", label: "AI Controller", icon: "📊" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-[var(--card-border)] bg-[var(--card)] flex flex-col">
      <div className="p-4 border-b border-[var(--card-border)]">
        <h1 className="text-lg font-bold">AI Dashboard</h1>
        <p className="text-xs text-[var(--muted)]">Company Management</p>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-1 transition-colors ${
                isActive
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
