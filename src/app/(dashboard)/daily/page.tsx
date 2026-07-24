"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";

type S = {
  id: string;
  title: string;
  status: string;
  estimateHours: number | null;
  blockReason: string | null;
  blockedAt: string | null;
  blockedDays: number;
  project: { id: string; name: string };
  assignees: { user: { id: string; name: string } }[];
};
type Daily = {
  date: string;
  completedYesterday: S[];
  inProgress: S[];
  blocked: S[];
  ticketsResolved: { id: string; number?: number; subject: string; assignee: { id: string; name: string } | null }[];
  projects: { id: string; name: string; plannedEndAt: string | null; total: number; done: number }[];
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—";
}

// Vista del DAILY para el líder: qué pasó ayer, qué está en curso y qué está bloqueado.
export default function DailyPage() {
  const [d, setD] = useState<Daily | null>(null);

  useEffect(() => {
    apiGet<Daily>("/api/daily").then(setD).catch(() => setD(null));
  }, []);

  if (!d) return <SkeletonRows />;

  // Agrupar por desarrollador
  const devs = new Map<string, { name: string; done: S[]; wip: S[]; blocked: S[] }>();
  const add = (list: S[], key: "done" | "wip" | "blocked") => {
    for (const s of list) {
      const u = s.assignees[0]?.user;
      const id = u?.id ?? "—";
      const entry = devs.get(id) ?? { name: u?.name ?? "Sin responsable", done: [], wip: [], blocked: [] };
      entry[key].push(s);
      devs.set(id, entry);
    }
  };
  add(d.completedYesterday, "done");
  add(d.inProgress, "wip");
  add(d.blocked, "blocked");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily</h1>
        <p className="text-sm text-muted">Resumen del día anterior ({fmt(d.date)}): avances, trabajo en curso y bloqueos.</p>
      </div>

      {/* Proyectos */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {d.projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40">
            <div className="font-medium">{p.name}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-brand" style={{ width: `${p.total ? Math.round((p.done / p.total) * 100) : 0}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted">
              <span>{p.done}/{p.total} actividades</span>
              <span>Fin: {fmt(p.plannedEndAt)}</span>
            </div>
          </Link>
        ))}
      </section>

      {/* Por desarrollador */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Por desarrollador</h2>
        {[...devs.values()].map((dev) => (
          <div key={dev.name} className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
                {dev.name.split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase()}
              </span>
              <span className="font-medium">{dev.name}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-success">✔ Completó ayer ({dev.done.length})</p>
                {dev.done.length === 0 && <p className="text-xs text-muted">—</p>}
                {dev.done.map((s) => (
                  <p key={s.id} className="line-clamp-1 text-xs">{s.title} <span className="text-muted">· {s.project.name}</span></p>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-warning">▶ En ejecución ({dev.wip.length})</p>
                {dev.wip.length === 0 && <p className="text-xs text-muted">—</p>}
                {dev.wip.map((s) => (
                  <p key={s.id} className="line-clamp-1 text-xs">{s.title} <span className="text-muted">· {s.project.name}</span></p>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-danger">⛔ Bloqueado ({dev.blocked.length})</p>
                {dev.blocked.length === 0 && <p className="text-xs text-muted">—</p>}
                {dev.blocked.map((s) => (
                  <div key={s.id} className="mb-1 text-xs">
                    <p className="line-clamp-1">{s.title} <span className="text-muted">· {s.project.name}</span></p>
                    {s.blockReason && <p className="line-clamp-2 text-muted">↳ {s.blockReason}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {devs.size === 0 && <p className="text-sm text-muted">Sin actividad registrada ayer.</p>}
      </section>

      {/* Tickets resueltos ayer */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Tickets resueltos ayer ({d.ticketsResolved.length})</h2>
        {d.ticketsResolved.length === 0 ? (
          <p className="text-sm text-muted">Ninguno.</p>
        ) : (
          d.ticketsResolved.map((t) => (
            <Link key={t.id} href={`/service-desk/${t.id}`} className="block rounded-xl border border-border bg-surface px-4 py-2 text-sm hover:border-brand/40">
              {t.number != null && <span className="mr-2 font-mono text-muted">#{String(t.number).padStart(3, "0")}</span>}
              {t.subject}
              {t.assignee && <span className="text-muted"> · {t.assignee.name}</span>}
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
