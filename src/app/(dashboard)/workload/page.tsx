"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";

type Story = { id: string; title: string; project: string; hours: number };
type Day = {
  date: string;
  isWorkDay: boolean;
  isHoliday: boolean;
  capacityHours: number;
  meetingHours: number;
  assignedHours: number;
  stories: Story[];
};
type Person = {
  id: string;
  name: string;
  jobTitle: string | null;
  dailyHours: number;
  capacityHours: number;
  meetingHours: number;
  assignedHours: number;
  loadPct: number;
  byDay: Day[];
};
type Workload = {
  weekStart: string;
  weekEnd: string;
  workingDays: number;
  days: string[];
  people: Person[];
};

function fmtLong(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("es", {
    day: "2-digit", month: "long", timeZone: "UTC",
  });
}
function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("es", {
    weekday: "short", day: "2-digit", timeZone: "UTC",
  });
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase();
}
function todayMondayKey(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const d = new Date(`${today}T00:00:00.000Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000);
  return monday.toISOString().slice(0, 10);
}
function shiftWeek(iso: string, weeks: number) {
  const t = new Date(`${iso}T00:00:00.000Z`).getTime() + weeks * 7 * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

// Semáforo por % de carga:
//   <80%  verde  · tiene margen
//   80-100% amarillo · al tope
//   >100% rojo · sobreasignada
function loadTone(pct: number): { cls: string; label: string } {
  if (pct >= 101) return { cls: "bg-danger text-white", label: "Sobreasignada" };
  if (pct >= 80) return { cls: "bg-warning text-white", label: "Al tope" };
  return { cls: "bg-success text-white", label: "Con holgura" };
}

// Barra de progreso: rellenamos hasta 100% con color del semáforo. Si excede,
// aparece un segmento rojo que se extiende sobre el fondo para mostrar exceso.
function LoadBar({ pct }: { pct: number }) {
  const filled = Math.min(pct, 100);
  const excess = Math.max(0, pct - 100);
  const tone = loadTone(pct);
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-background">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${
          pct >= 101 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-success"
        }`}
        style={{ width: `${filled}%` }}
        aria-label={tone.label}
      />
      {excess > 0 && (
        <div
          className="absolute inset-y-0 rounded-full bg-danger/70"
          style={{ left: "100%", width: `${Math.min(excess, 50)}%` }}
        />
      )}
    </div>
  );
}

// Vista de carga por persona (semanal, lun-dom). Solo líder/admin. Ayuda a
// detectar sobreasignación antes de que el cronograma reviente: capacidad
// efectiva = dailyHours × días hábiles − reuniones. Asignado = suma de horas
// de actividades activas repartidas uniformemente sobre sus días hábiles.
export default function WorkloadPage() {
  const [week, setWeek] = useState<string>(todayMondayKey());
  const [data, setData] = useState<Workload | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load(w: string) {
    setData(null);
    setData(await apiGet<Workload>(`/api/workload?week=${w}`));
  }
  useEffect(() => { load(week); }, [week]);

  const totals = useMemo(() => {
    if (!data) return null;
    const t = data.people.reduce(
      (acc, p) => ({
        capacity: acc.capacity + p.capacityHours,
        assigned: acc.assigned + p.assignedHours,
        meetings: acc.meetings + p.meetingHours,
        overload: acc.overload + (p.loadPct >= 101 ? 1 : 0),
        atTop: acc.atTop + (p.loadPct >= 80 && p.loadPct < 101 ? 1 : 0),
      }),
      { capacity: 0, assigned: 0, meetings: 0, overload: 0, atTop: 0 },
    );
    return t;
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Carga por persona</h1>
          <p className="text-sm text-muted">
            Cuánto tiene asignado cada persona esta semana vs. su capacidad efectiva.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            onClick={() => setWeek(shiftWeek(week, -1))}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:border-brand/40"
          >
            ‹ Semana anterior
          </button>
          <button
            onClick={() => setWeek(todayMondayKey())}
            className="rounded-lg border border-brand/40 bg-brand-soft px-3 py-1.5 font-medium text-brand hover:brightness-110"
          >
            Esta semana
          </button>
          <button
            onClick={() => setWeek(shiftWeek(week, 1))}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:border-brand/40"
          >
            Semana siguiente ›
          </button>
        </div>
      </header>

      {data ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Semana</div>
              <div className="text-lg font-semibold">
                {fmtLong(data.weekStart)} → {fmtLong(data.weekEnd)}
              </div>
            </div>
            {totals && (
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted">Personas</div>
                  <div className="font-mono font-semibold">{data.people.length}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Capacidad</div>
                  <div className="font-mono font-semibold">{Math.round(totals.capacity)}h</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Asignado</div>
                  <div className="font-mono font-semibold">{Math.round(totals.assigned)}h</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Reuniones</div>
                  <div className="font-mono font-semibold">{Math.round(totals.meetings)}h</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Sobreasignadas</div>
                  <div className={`font-mono font-semibold ${totals.overload > 0 ? "text-danger" : ""}`}>
                    {totals.overload}
                  </div>
                </div>
              </div>
            )}
          </div>

          {data.people.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center text-sm text-muted">
              No hay desarrolladores o líderes técnicos activos para medir carga.
            </div>
          ) : (
            <div className="space-y-3">
              {data.people.map((p) => {
                const tone = loadTone(p.loadPct);
                const isOpen = expanded === p.id;
                return (
                  <div key={p.id} className="rounded-2xl border border-border bg-surface">
                    <button
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                        {initials(p.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium" title={p.name}>{p.name}</div>
                        <div className="truncate text-xs text-muted">
                          {p.jobTitle ?? "—"} · {p.dailyHours}h/día
                        </div>
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
                        <div className="text-right text-xs text-muted">
                          <span className="font-mono">{Math.round(p.assignedHours)}h</span> / <span className="font-mono">{Math.round(p.capacityHours)}h</span>
                          {p.meetingHours > 0 && (
                            <> · <span title="Horas ya ocupadas por reuniones">🗓 {Math.round(p.meetingHours)}h</span></>
                          )}
                        </div>
                        <div className="w-32">
                          <LoadBar pct={p.loadPct} />
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.cls}`}>
                          {p.loadPct}%
                        </span>
                        <span className="text-muted">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border p-3">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                          {p.byDay.map((d) => {
                            const pct = d.capacityHours > 0 ? Math.round((d.assignedHours / d.capacityHours) * 100) : d.assignedHours > 0 ? 999 : 0;
                            return (
                              <div
                                key={d.date}
                                className={`rounded-lg border p-2 text-xs ${
                                  !d.isWorkDay ? "border-dashed border-border bg-background/40 text-muted" : "border-border bg-background"
                                }`}
                              >
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="font-semibold uppercase">{fmtDay(d.date)}</span>
                                  {!d.isWorkDay && (
                                    <span title="Fin de semana o festivo">{d.isHoliday ? "🎉" : "—"}</span>
                                  )}
                                </div>
                                {d.isWorkDay && (
                                  <>
                                    <div className={`font-mono ${pct >= 101 ? "text-danger" : pct >= 80 ? "text-warning" : "text-success"}`}>
                                      {d.assignedHours}h / {d.capacityHours}h
                                    </div>
                                    {d.meetingHours > 0 && (
                                      <div className="text-[10px] text-muted" title="Reuniones y eventos">
                                        🗓 {d.meetingHours}h reunión
                                      </div>
                                    )}
                                    {d.stories.length > 0 && (
                                      <ul className="mt-1 space-y-0.5">
                                        {d.stories.slice(0, 5).map((s) => (
                                          <li key={s.id + s.hours} className="truncate" title={`${s.title} · ${s.project}`}>
                                            · {s.title}
                                          </li>
                                        ))}
                                        {d.stories.length > 5 && (
                                          <li className="text-muted">…y {d.stories.length - 5} más</li>
                                        )}
                                      </ul>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <SkeletonRows count={6} />
      )}
    </div>
  );
}
