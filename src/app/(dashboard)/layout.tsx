import { redirect } from "next/navigation";
import { getCurrentUser, getUserPermissions } from "@/server/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Sidebar, type NavItem } from "@/components/nav/Sidebar";
import { Wordmark } from "@/components/brand/Logo";
import { AlertsBell } from "@/components/nav/AlertsBell";
import { t } from "@/i18n";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // El cliente-final no usa el panel del equipo: va a su portal reducido.
  const isStaff = user.roles.some((r) => ["admin", "tech_lead", "developer"].includes(r.role.key));
  if (!isStaff) redirect("/portal");

  const perms = await getUserPermissions(user.id);
  const can = (resource: string) => perms.has(`read:${resource}`);
  const roleNames = user.roles.map((r) => r.role.name).join(", ") || "Sin rol";

  const items: NavItem[] = [{ href: "/dashboard", label: t.nav.dashboard, icon: "dashboard" }];
  if (can("project")) items.push({ href: "/projects", label: t.nav.projects, icon: "projects" });
  const isLead = user.roles.some((r) => ["admin", "tech_lead"].includes(r.role.key));
  if (isLead) items.push({ href: "/daily", label: "Daily", icon: "dashboard" });
  if (isStaff) items.push({ href: "/meetings", label: "Reuniones", icon: "meetings" });
  if (can("ticket")) items.push({ href: "/service-desk", label: t.nav.serviceDesk, icon: "service" });
  if (can("design_doc")) items.push({ href: "/discovery", label: t.nav.discovery, icon: "discovery" });
  if (can("client")) items.push({ href: "/clients", label: t.nav.clients, icon: "clients" });
  if (can("user")) items.push({ href: "/admin/users", label: "Equipo", icon: "team" });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Wordmark size={30} />
          <div className="ml-auto flex items-center gap-3">
            <AlertsBell />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{user.name}</div>
              <div className="text-xs text-muted">{roleNames}</div>
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
            {/* Manual de uso (página estática servida en /doc) */}
            <a
              href="/doc"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Manual
            </a>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
