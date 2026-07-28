"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";

type Log = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    roles: { role: { key: string; name: string } }[];
  } | null;
};

const ACTION_LABEL: Record<string, string> = {
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  register: "Registro",
  create: "Creó",
  update: "Actualizó",
  delete: "Eliminó",
  status_change: "Cambió estado",
  upload: "Subió",
};
const RESOURCE_LABEL: Record<string, string> = {
  user: "usuario",
  client: "cliente",
  project: "proyecto",
  sprint: "hito",
  epic: "fase",
  story: "actividad",
  task: "subtarea",
  ticket: "ticket",
  design_doc: "documento",
  attachment: "adjunto",
  meeting: "reunión",
};
const ACTION_COLOR: Record<string, string> = {
  delete: "text-danger",
  create: "text-success",
  update: "text-info",
  status_change: "text-warning",
};
const ROLE_BADGE: Record<string, string> = {
  admin: "bg-danger/15 text-danger",
  tech_lead: "bg-warning/15 text-warning",
  developer: "bg-info/15 text-info",
  client: "bg-muted/15 text-muted",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function summarize(log: Log) {
  const md = log.metadata ?? {};
  const name =
    (md.name as string | undefined) ??
    (md.title as string | undefined) ??
    (md.email as string | undefined) ??
    (md.subject as string | undefined) ??
    log.resourceId ?? "";
  const proj = (md.projectName as string | undefined);
  return { name, proj };
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: "", resource: "", q: "", since: "", until: "" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.action) p.set("action", filters.action);
    if (filters.resource) p.set("resource", filters.resource);
    if (filters.q) p.set("q", filters.q);
    if (filters.since) p.set("since", filters.since);
    if (filters.until) p.set("until", filters.until);
    p.set("limit", "200");
    return p.toString();
  }, [filters]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiGet<Log[]>(`/api/admin/logs?${query}`)
      .then((r) => !cancel && setLogs(r))
      .catch(() => !cancel && setLogs([]))
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [query]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="text-sm text-muted">Registro de acciones del equipo: quién hizo qué y cuándo.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-5">
        <select
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={filters.resource}
          onChange={(e) => setFilters((f) => ({ ...f, resource: e.target.value }))}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
        >
          <option value="">Todos los recursos</option>
          {Object.entries(RESOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input
          type="date"
          value={filters.since}
          onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value }))}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground [color-scheme:dark]"
          title="Desde"
        />
        <input
          type="date"
          value={filters.until}
          onChange={(e) => setFilters((f) => ({ ...f, until: e.target.value }))}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground [color-scheme:dark]"
          title="Hasta"
        />
        <input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Buscar por persona o id…"
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted"
        />
      </div>

      {loading && !logs ? (
        <SkeletonRows />
      ) : !logs || logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-10 text-center text-sm text-muted">
          Sin registros para los filtros elegidos.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {logs.map((log) => {
            const roleKey = log.user?.roles[0]?.role.key ?? "";
            const roleName = log.user?.roles[0]?.role.name ?? "";
            const s = summarize(log);
            const projectId = (log.metadata?.projectId as string | undefined) ?? null;
            const action = ACTION_LABEL[log.action] ?? log.action;
            const resource = RESOURCE_LABEL[log.resource] ?? log.resource;
            return (
              <div key={log.id} className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 text-sm last:border-0">
                <span className="min-w-[110px] shrink-0 text-xs text-muted">{fmt(log.createdAt)}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                    {(log.user?.name ?? "?").split(" ").slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{log.user?.name ?? "Sistema"}</span>
                      {roleKey && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_BADGE[roleKey] ?? "bg-muted/15 text-muted"}`}>
                          {roleName}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">{log.user?.email ?? "—"}</div>
                  </div>
                </div>
                <div className="ml-auto min-w-0 max-w-full sm:max-w-[50%]">
                  <div className="text-sm">
                    <span className={`font-semibold ${ACTION_COLOR[log.action] ?? ""}`}>{action}</span>{" "}
                    <span className="text-muted">{resource}</span>
                    {s.name && (
                      <>
                        {" "}
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{s.name}</span>
                      </>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {s.proj && <>en <Link href={`/projects/${projectId}`} className="hover:underline">{s.proj}</Link> · </>}
                    {log.ip && <>desde {log.ip}</>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
