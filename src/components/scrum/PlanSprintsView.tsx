"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Button } from "@/components/ui/Field";
import { STORY_COLUMNS } from "@/lib/scrumTypes";

type PlanStory = {
  id: string;
  title: string;
  status: string;
  estimateHours: number | null;
  startDate: string | null;
  estimatedEnd: string | null;
  assignees: { user: { id: string; name: string } }[];
  epic: { title: string; sprint: { id: string; name: string } | null } | null;
};
type PlanSprint = {
  id: string;
  index: number;
  startDate: string;
  endDate: string;
  stories: PlanStory[];
  hitos: { name: string; count: number; hours: number }[];
};
type Plan = {
  project: { startDate: string | null; plannedEndAt: string | null; sprintWeeks: number; createdAt: string };
  sprints: PlanSprint[];
  unplanned: number;
};

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STORY_COLUMNS.map((c) => [c.key, c.label]));

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  // Las fechas del motor son días puros en UTC; se muestran sin corrimiento de zona.
  return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
function toInput(d: string | null) {
  return d ? d.slice(0, 10) : "";
}

// Sprints AUTOGENERADOS por el motor de planificación: muestra qué hitos y
// actividades entran en cada sprint, con fechas calculadas automáticamente.
export function PlanSprintsView({ projectId, canPlan }: { projectId: string; canPlan: boolean }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [len, setLen] = useState("2");

  const load = useCallback(async () => {
    const p = await apiGet<Plan>(`/api/projects/${projectId}/plan`);
    setPlan(p);
    setStartDate(toInput(p.project.startDate ?? p.project.createdAt));
    setLen(String(p.project.sprintWeeks));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveConfigAndReplan() {
    setBusy(true);
    try {
      await apiSend(`/api/projects/${projectId}`, "PATCH", {
        startDate: startDate || null,
        sprintWeeks: Number(len) || 2,
      });
      await apiSend("/api/planning/replan", "POST", { projectId });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!plan) return <p className="text-sm text-muted">Calculando cronograma…</p>;

  return (
    <div className="space-y-4">
      {/* Resumen del cronograma calculado */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Inicio del proyecto</div>
          <div className="text-lg font-semibold">{fmt(plan.project.startDate ?? plan.project.createdAt)}</div>
        </div>
        <div className="text-2xl text-muted" aria-hidden>→</div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Fin estimado (calculado)</div>
          <div className="text-lg font-semibold text-brand">{fmt(plan.project.plannedEndAt)}</div>
        </div>
        <div className="ml-auto flex items-end gap-2">
          {canPlan && (
            <>
              <div>
                <label className="mb-1 block text-[11px] text-muted">Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-border-strong bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted">Sprint (semanas, lun→dom)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={len}
                  onChange={(e) => setLen(e.target.value)}
                  className="w-24 rounded-lg border border-border-strong bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <Button onClick={saveConfigAndReplan} loading={busy} className="w-auto px-4">
                Replanificar
              </Button>
            </>
          )}
        </div>
      </div>

      {plan.unplanned > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          ⚠ {plan.unplanned} actividad(es) sin responsable o sin horas estimadas: no entran al cálculo.
        </div>
      )}

      {plan.sprints.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center text-sm text-muted">
          Aún no hay sprints calculados. Asigna <strong>responsable</strong> y <strong>horas estimadas</strong> a las
          actividades{canPlan ? " y pulsa Replanificar" : ""}: el sistema generará los sprints automáticamente.
        </div>
      ) : (
        plan.sprints.map((sp) => (
          <section key={sp.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-fg">
                S{sp.index}
              </span>
              <div>
                <div className="font-semibold">Sprint {sp.index}</div>
                <div className="text-xs text-muted">
                  {fmt(sp.startDate)} → {fmt(sp.endDate)}
                </div>
              </div>
              {/* Hitos que entran en este sprint */}
              <div className="ml-auto flex flex-wrap gap-1.5">
                {sp.hitos.map((h) => (
                  <span key={h.name} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand">
                    {h.name} · {h.count} act. · {h.hours}h
                  </span>
                ))}
              </div>
            </header>
            <div className="divide-y divide-border">
              {sp.stories.map((st) => (
                <div key={st.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{st.title}</span>
                  <span className="text-[11px] text-muted">
                    {fmt(st.startDate)} → {fmt(st.estimatedEnd)}
                  </span>
                  {st.estimateHours != null && (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
                      {st.estimateHours}h
                    </span>
                  )}
                  <span className="text-[11px] text-muted">{STATUS_LABEL[st.status] ?? st.status}</span>
                  <div className="flex -space-x-1">
                    {st.assignees.slice(0, 2).map((a) => (
                      <span
                        key={a.user.id}
                        title={a.user.name}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-fg ring-2 ring-surface"
                      >
                        {a.user.name.charAt(0).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
