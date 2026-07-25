import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Sidebar, type NavItem } from "@/components/nav/Sidebar";
import { Wordmark } from "@/components/brand/Logo";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

// Portal reducido del CLIENTE. Layout propio (no es el panel del equipo):
// solo el avance de sus proyectos, sus documentos de diseño y su soporte.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isStaff = user.roles.some((r) => ["admin", "tech_lead", "developer"].includes(r.role.key));
  if (isStaff) redirect("/dashboard");

  const items: NavItem[] = [
    { href: "/portal/proyectos", label: "Mis proyectos", icon: "projects" },
    { href: "/portal/documentos", label: "Mis aprobaciones", icon: "discovery" },
    { href: "/portal/soporte", label: "Mis tickets", icon: "service" },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Wordmark size={30} />
          <span className="ml-2 hidden rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand sm:inline">
            Portal del cliente
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{user.name}</div>
              <div className="text-xs text-muted">Cliente</div>
            </div>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand"
              title={user.name}
            >
              {initials(user.name)}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:flex-row sm:gap-8 sm:px-6">
        <aside className="sm:w-52 sm:shrink-0">
          <div className="sm:sticky sm:top-20">
            <Sidebar items={items} />
            {/* Guía del usuario final (página estática servida en /guia) */}
            <a
              href="/guia"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Guía de uso
            </a>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
