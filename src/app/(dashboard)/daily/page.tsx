"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";

type Story = {
  id: string;
  title: string;
  status: string;
  priority: string;
  estimateHours: number | null;
  spentHours: number;
  blockReason: string | null;
  blockedAt: string | null;
  blockedDays: number;
  project: { id: string; name: string };
};
type ProjChip = { id: string; name: string; total: number; done: number; active: number };
type Dev = {
  id: string;
  name: string;
  jobTitle: string | null;
  projects: ProjChip[];
  completed: Story[];
  inProgress: Story[];
  blocked: Story[];
};
type Daily = {
  date: string;
  isYesterday: boolean;
  developers: Dev[];
  totals: { completed: number; inProgress: number; blocked: number };
  ticketsResolved: { id: string; number?: number; subject: string; assignee: { id: string; name: string } | null }[];
  projects: { id: string; name: string; plannedEndAt: string | null; total: number; done: number }[];
};

function fmtLong(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}
function fmtShort(d: string | null) {
  return d ? new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—";
}
function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}
function hrs(s: Story) {
  const real = s.spentHours ? `${s.spentHours}h` : null;
  const est = s.estimateHours ? `${s.estimateHours}h est.` : null;
  return [real, est].filter(Boolean).join(" · ");
}
// Días bloqueada = acumulado (blockedDays, se suma al desbloquear) + el tramo
// actual desde blockedAt hasta hoy, para que refleje el bloqueo en curso.
function blockedLabel(s: Story) {
  let days = s.blockedDays || 0;
  if (s.blockedAt) {
    const start = new Date(s.blockedAt);
    const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    days += Math.max(0, Math.round((todayUTC - startUTC) / 86400000));
  }
  if (days <= 0) return "Bloqueada hoy";
  return `${days} día${days === 1 ? "" : "s"} bloqueada`;
}
// YYYY-MM-DD de "ayer" en UTC (coincide con el default del backend).
function yesterdayKey() {
  const n = new Date();
  const t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
function shiftKey(key: string, days: number) {
  const t = new Date(`${key}T00:00:00.000Z`).getTime() + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
const todayKey = () => new Date().toISOString().slice(0, 10);

const prioDot: Record<string, string> = {
  URGENT: "bg-danger",
  HIGH: "bg-warning",
  MEDIUM: "bg-brand",
  LOW: "bg-muted",
};

// Vista del DAILY para el líder: navegable por fecha y centrada en cada
// desarrollador — sus proyectos, lo que ejecutó ese día y sus bloqueos.
export default function DailyPage() {
  const [date, setDate] = useState(yesterdayKey());
  const [d, setD] = useState<Daily | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiGet<Daily>(`/api/daily?date=${date}`)
      .then((res) => !cancel && setD(res))
      .catch(() => !cancel && setD(null))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [date]);

  const developers = useMemo(() => {
    if (!d) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return d.developers;
    return d.developers.filter(
      (dev) =>
        dev.name.toLowerCase().includes(needle) ||
        (dev.jobTitle ?? "").toLowerCase().includes(needle) ||
        dev.projects.some((p) => p.name.toLowerCase().includes(needle)),
    );
  }, [d, q]);

  const isToday = date === todayKey();

  return (
    <div className="space-y-6">
      {/* Encabezado + navegador de fecha (dinámico) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily</h1>
          <p className="text-sm text-muted">
            {d ? (
              <>
                <span className="capitalize">{fmtLong(d.date)}</span>
                {d.isYesterday && <span className="text-muted"> · ayer</span>}
              </>
            ) : (
              "Cargando resumen…"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate((k) => shiftKey(k, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-brand/40 hover:text-foreground"
            aria-label="Día anterior"
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            max={todayKey()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 rounded-xl border border-border bg-surface px-3 text-sm text-foreground [color-scheme:dark]"
          />
          <button
            onClick={() => setDate((k) => shiftKey(k, +1))}
            disabled={isToday}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-brand/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Día siguiente"
          >
            ›
          </button>
          {!d?.isYesterday && (
            <button
              onClick={() => setDate(yesterdayKey())}
              className="h-9 rounded-xl border border-border bg-surface px-3 text-xs text-muted transition hover:border-brand/40 hover:text-foreground"
            >
              Ayer
            </button>
          )}
        </div>
      </div>

      {/* Barra de totales del día */}
      {d && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Ejecutadas" value={d.totals.completed} tone="text-success" />
          <Stat label="En ejecución" value={d.totals.inProgress} tone="text-warning" />
          <Stat label="Bloqueadas" value={d.totals.blocked} tone="text-danger" />
        </div>
      )}

      {/* Filtro por desarrollador (dinámico) */}
      {d && d.developers.length > 0 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por desarrollador, cargo o proyecto…"
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
        />
      )}

      {/* Por desarrollador */}
      {loading && !d ? (
        <SkeletonRows />
      ) : (
        <section className={`space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {developers.map((dev) => (
            <div key={dev.id} className="rounded-2xl border border-border bg-surface p-5">
              {/* Cabecera del desarrollador */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                    {initials(dev.name)}
                  </span>
                  <div>
                    <div className="font-medium leading-tight">{dev.name}</div>
                    <div className="text-xs text-muted">{dev.jobTitle ?? "Sin cargo"}</div>
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-success">✔ {dev.completed.length}</span>
                  <span className="text-warning">▶ {dev.inProgress.length}</span>
                  <span className="text-danger">⛔ {dev.blocked.length}</span>
                </div>
              </div>

              {/* Sus proyectos */}
              {dev.projects.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Proyectos</p>
                  <div className="flex flex-wrap gap-2">
                    {dev.projects.map((p) => (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="group flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 transition hover:border-brand/40"
                      >
                        <span className="text-xs font-medium">{p.name}</span>
                        <span className="text-[10px] text-muted">
                          {p.done}/{p.total}
                        </span>
                        <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface">
                          <span
                            className="block h-full rounded-full bg-brand"
                            style={{ width: `${p.total ? Math.round((p.done / p.total) * 100) : 0}%` }}
                          />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Ejecutadas / En ejecución / Bloqueos */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Column title={`Ejecutadas (${dev.completed.length})`} tone="text-success">
                  {dev.completed.map((s) => (
                    <StoryLine key={s.id} s={s} meta={hrs(s)} />
                  ))}
                  {dev.completed.length === 0 && <Empty />}
                </Column>

                <Column title={`En ejecución (${dev.inProgress.length})`} tone="text-warning">
                  {dev.inProgress.map((s) => (
                    <StoryLine key={s.id} s={s} meta={hrs(s)} />
                  ))}
                  {dev.inProgress.length === 0 && <Empty />}
                </Column>

                <Column title={`Bloqueos (${dev.blocked.length})`} tone="text-danger">
                  {dev.blocked.map((s) => (
                    <div key={s.id} className="rounded-lg border border-danger/20 bg-danger/5 px-2.5 py-1.5">
                      <StoryLine s={s} bare />
                      {s.blockReason && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">↳ {s.blockReason}</p>}
                      <p className="mt-0.5 text-[10px] font-medium text-danger">
                        {blockedLabel(s)}
                        {s.blockedAt && ` · desde ${fmtShort(s.blockedAt)}`}
                      </p>
                    </div>
                  ))}
                  {dev.blocked.length === 0 && <Empty />}
                </Column>
              </div>
            </div>
          ))}

          {developers.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted">
              {q ? "Ningún desarrollador coincide con el filtro." : "Sin actividad registrada este día."}
            </p>
          )}
        </section>
      )}

      {/* Tickets resueltos ese día */}
      {d && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Tickets resueltos ({d.ticketsResolved.length})
          </h2>
          {d.ticketsResolved.length === 0 ? (
            <p className="text-sm text-muted">Ninguno.</p>
          ) : (
            <div className="space-y-1.5">
              {d.ticketsResolved.map((t) => (
                <Link
                  key={t.id}
                  href={`/service-desk/${t.id}`}
                  className="block rounded-xl border border-border bg-surface px-4 py-2 text-sm hover:border-brand/40"
                >
                  {t.number != null && <span className="mr-2 font-mono text-muted">#{String(t.number).padStart(3, "0")}</span>}
                  {t.subject}
                  {t.assignee && <span className="text-muted"> · {t.assignee.name}</span>}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Column({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`mb-2 text-xs font-semibold ${tone}`}>{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function StoryLine({ s, meta, bare }: { s: Story; meta?: string; bare?: boolean }) {
  const body = (
    <>
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${prioDot[s.priority] ?? "bg-muted"}`} />
      <span className="min-w-0">
        <span className="line-clamp-1 text-xs">{s.title}</span>
        <span className="line-clamp-1 text-[10px] text-muted">
          {s.project.name}
          {meta ? ` · ${meta}` : ""}
        </span>
      </span>
    </>
  );
  if (bare) return <div className="flex items-start gap-1.5">{body}</div>;
  return (
    <Link
      href={`/projects/${s.project.id}`}
      className="flex items-start gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 transition hover:border-brand/40"
    >
      {body}
    </Link>
  );
}

function Empty() {
  return <p className="text-xs text-muted">—</p>;
}
