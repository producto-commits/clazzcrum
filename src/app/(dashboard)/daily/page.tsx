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
  project: { id: string; name: string };
};
type Block = Story & { blockReason: string | null; blockedAt: string | null; blockedDays: number };
type Meet = { id: string; title: string; date: string; hours: number };
type Tix = { id: string; number: number | null; subject: string; priority: string; status?: string };
type ProjChip = { id: string; name: string; total: number; done: number; active: number };
type Dev = {
  id: string;
  name: string;
  jobTitle: string | null;
  projects: ProjChip[];
  yesterday: { done: Story[]; meetings: Meet[]; tickets: Tix[] };
  today: { planned: Story[]; meetings: Meet[]; tickets: Tix[] };
  blocked: Block[];
};
type Daily = {
  today: string;
  yesterday: string;
  isToday: boolean;
  developers: Dev[];
  totals: { yesterdayDone: number; todayPlanned: number; blocked: number };
  projects: { id: string; name: string; plannedEndAt: string | null; total: number; done: number }[];
};

function fmtLong(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    weekday: "long", day: "2-digit", month: "long", timeZone: "UTC",
  });
}
function fmtShort(d: string | null) {
  return d ? new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—";
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase();
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function shiftKey(key: string, days: number) {
  const t = new Date(`${key}T00:00:00.000Z`).getTime() + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
function blockedLabel(s: Block) {
  let days = s.blockedDays || 0;
  if (s.blockedAt) {
    const start = new Date(s.blockedAt);
    const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const now = new Date();
    const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    days += Math.max(0, Math.round((t - startUTC) / 86400000));
  }
  if (days <= 0) return "Bloqueada hoy";
  return `${days} día${days === 1 ? "" : "s"} bloqueada`;
}

const prioDot: Record<string, string> = {
  URGENT: "bg-danger", CRITICAL: "bg-danger", HIGH: "bg-warning", MEDIUM: "bg-brand", LOW: "bg-muted",
};

// Daily del líder: por cada desarrollador, muestra AYER (ejecutadas, reuniones,
// tickets atendidos) y HOY (a realizar, reuniones, tickets abiertos).
export default function DailyPage() {
  const [date, setDate] = useState(todayKey());
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
    return () => { cancel = true; };
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily</h1>
          <p className="text-sm text-muted">
            {d ? (
              <>Hoy: <span className="capitalize text-foreground">{fmtLong(d.today)}</span>
                <span className="text-muted"> · comparado con ayer ({fmtShort(d.yesterday)})</span></>
            ) : "Cargando resumen…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate((k) => shiftKey(k, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-brand/40 hover:text-foreground"
            aria-label="Día anterior"
          >‹</button>
          <input
            type="date" value={date} max={todayKey()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 rounded-xl border border-border bg-surface px-3 text-sm text-foreground [color-scheme:dark]"
          />
          <button
            onClick={() => setDate((k) => shiftKey(k, +1))}
            disabled={isToday}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-brand/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Día siguiente"
          >›</button>
          {!isToday && (
            <button
              onClick={() => setDate(todayKey())}
              className="h-9 rounded-xl border border-border bg-surface px-3 text-xs text-muted transition hover:border-brand/40 hover:text-foreground"
            >Hoy</button>
          )}
        </div>
      </div>

      {d && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Ejecutadas ayer" value={d.totals.yesterdayDone} tone="text-success" />
          <Stat label="A realizar hoy" value={d.totals.todayPlanned} tone="text-warning" />
          <Stat label="Bloqueadas" value={d.totals.blocked} tone="text-danger" />
        </div>
      )}

      {d && d.developers.length > 0 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por desarrollador, cargo o proyecto…"
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
        />
      )}

      {loading && !d ? (
        <SkeletonRows />
      ) : (
        <section className={`space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {developers.map((dev) => (
            <div key={dev.id} className="rounded-2xl border border-border bg-surface p-5">
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
                  <span className="text-success">✔ ayer {dev.yesterday.done.length}</span>
                  <span className="text-warning">▶ hoy {dev.today.planned.length}</span>
                  <span className="text-danger">⛔ {dev.blocked.length}</span>
                </div>
              </div>

              {dev.projects.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Proyectos</p>
                  <div className="flex flex-wrap gap-2">
                    {dev.projects.map((p) => (
                      <Link key={p.id} href={`/projects/${p.id}`}
                        className="group flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 transition hover:border-brand/40">
                        <span className="text-xs font-medium">{p.name}</span>
                        <span className="text-[10px] text-muted">{p.done}/{p.total}</span>
                        <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface">
                          <span className="block h-full rounded-full bg-brand"
                            style={{ width: `${p.total ? Math.round((p.done / p.total) * 100) : 0}%` }} />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Dos columnas grandes: AYER y HOY */}
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <DayColumn
                  header="Ayer"
                  headerNote="Lo ejecutado y atendido"
                  activityTitle="Ejecutadas"
                  activities={dev.yesterday.done}
                  meetings={dev.yesterday.meetings}
                  tickets={dev.yesterday.tickets}
                />
                <DayColumn
                  header="Hoy"
                  headerNote="Lo que toca"
                  activityTitle="A realizar"
                  activities={dev.today.planned}
                  meetings={dev.today.meetings}
                  tickets={dev.today.tickets}
                />
              </div>

              {dev.blocked.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-danger">Bloqueos ({dev.blocked.length})</p>
                  <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
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
                  </div>
                </div>
              )}
            </div>
          ))}
          {developers.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted">
              {q ? "Ningún desarrollador coincide con el filtro." : "Sin actividad para este día."}
            </p>
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

function DayColumn({
  header, headerNote, activityTitle, activities, meetings, tickets,
}: {
  header: string; headerNote: string; activityTitle: string;
  activities: Story[]; meetings: Meet[]; tickets: Tix[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <p className="text-sm font-semibold">{header}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted">{headerNote}</p>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-background p-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">
            {activityTitle} ({activities.length})
          </p>
          <div className="space-y-1">
            {activities.length === 0 && <p className="text-[11px] text-muted">—</p>}
            {activities.map((s) => (
              <StoryLine key={s.id} s={s} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Reuniones ({meetings.length})</p>
          <div className="space-y-1">
            {meetings.length === 0 && <p className="text-[11px] text-muted">—</p>}
            {meetings.map((m) => (
              <div key={m.id} className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs">
                <span className="mr-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand">
                  {fmtTime(m.date)} · {m.hours}h
                </span>
                <span className="line-clamp-1">{m.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Tickets ({tickets.length})</p>
          <div className="space-y-1">
            {tickets.length === 0 && <p className="text-[11px] text-muted">—</p>}
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/service-desk/${t.id}`}
                className="flex items-start gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs transition hover:border-brand/40"
              >
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${prioDot[t.priority] ?? "bg-muted"}`} />
                <span className="min-w-0 flex-1">
                  {t.number != null && (
                    <span className="mr-1 font-mono text-[10px] text-muted">
                      #{String(t.number).padStart(3, "0")}
                    </span>
                  )}
                  <span className="line-clamp-1">{t.subject}</span>
                </span>
                {t.status && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted">{t.status}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryLine({ s, bare }: { s: Story | Block; bare?: boolean }) {
  const body = (
    <>
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${prioDot[s.priority] ?? "bg-muted"}`} />
      <span className="min-w-0">
        <span className="line-clamp-1 text-xs">{s.title}</span>
        <span className="line-clamp-1 text-[10px] text-muted">
          {s.project.name}
          {s.estimateHours ? ` · ${s.estimateHours}h est.` : ""}
        </span>
      </span>
    </>
  );
  if (bare) return <div className="flex items-start gap-1.5">{body}</div>;
  return (
    <Link
      href={`/projects/${s.project.id}`}
      className="flex items-start gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 transition hover:border-brand/40"
    >
      {body}
    </Link>
  );
}
