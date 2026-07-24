"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: IconName };

type IconName = "dashboard" | "projects" | "service" | "discovery" | "clients" | "team";

function Icon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
      );
    case "projects":
      return (
        <svg {...common}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></svg>
      );
    case "service":
      return (
        <svg {...common}><path d="M4 13a8 8 0 0116 0" /><path d="M4 13v3a2 2 0 002 2h1v-6H6a2 2 0 00-2 1zM20 13v3a2 2 0 01-2 2h-1v-6h1a2 2 0 012 1z" /></svg>
      );
    case "discovery":
      return (
        <svg {...common}><path d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M14 3v5h5M8 13h8M8 17h6" /></svg>
      );
    case "clients":
      return (
        <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M4 20a5 5 0 0110 0M16 6a3 3 0 010 6M20 20a5 5 0 00-4-4.9" /></svg>
      );
    case "team":
      return (
        <svg {...common}><circle cx="12" cy="7" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0113 0" /><path d="M18 9.5a2.5 2.5 0 000-5M20.5 20a4.5 4.5 0 00-3-4.2" /></svg>
      );
  }
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
      {items.map((it) => {
        const active =
          pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-soft text-brand"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {/* Riel activo (solo escritorio) */}
            <span
              className={`absolute -left-2 top-1/2 hidden h-5 w-1 -translate-y-1/2 rounded-full bg-brand transition-opacity sm:block ${
                active ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden
            />
            <span className={active ? "text-brand" : "text-muted group-hover:text-foreground"}>
              <Icon name={it.icon} />
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
