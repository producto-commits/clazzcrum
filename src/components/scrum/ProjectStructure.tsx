"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Button } from "@/components/ui/Field";
import { PRIORITY_CLASSES, PRIORITY_LABELS } from "@/components/ui/Inputs";
import { STORY_COLUMNS, storyCompliance, COMPLIANCE_META } from "@/lib/scrumTypes";

type SLite = {
  id: string;
  title: string;
  status: string;
  priority: string;
  estimateHours: number | null;
  estimatedEnd: string | null;
  actualEnd: string | null;
  assignees: { user: { id: string; name: string } }[];
  _count: { tasks: number; comments: number; acceptanceCriteria: number };
};
type ELite = { id: string; title: string; priority: string; sprintId: string | null; stories: SLite[] };
type SpLite = { id: string; name: string; goal: string | null; startDate: string; endDate: string; capacity: number | null; epics: ELite[] };
type Structure = { sprints: SpLite[]; looseEpics: ELite[]; looseStories: SLite[] };

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STORY_COLUMNS.map((c) => [c.key, c.label]));
const STATUS_DOT: Record<string, string> = {
  BACKLOG: "#8a8296",
  PLANNED: "var(--info)",
  IN_PROGRESS: "var(--warning)",
  QA: "#0ea5e9",
  BLOCKED: "var(--danger)",
  DONE: "var(--success)",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

function progressOf(stories: { status: string }[]) {
  const total = stories.length;
  const done = stories.filter((s) => s.status === "DONE").length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Barra de progreso compacta.
function Progress({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-background ${className}`}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Fila compacta de historia dentro de la estructura.
function StoryRow({ s, onOpen }: { s: SLite; onOpen: () => void }) {
  const c = storyCompliance(s.status, s.estimatedEnd, s.actualEnd);
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-background"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_DOT[s.status] }} title={STATUS_LABEL[s.status]} />
      <span className="min-w-0 flex-1 truncate">{s.title}</span>
      {(c === "overdue" || c === "late") && (
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${COMPLIANCE_META[c].cls}`}>⚠ {COMPLIANCE_META[c].label}</span>
      )}
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${PRIORITY_CLASSES[s.priority]}`}>{PRIORITY_LABELS[s.priority]}</span>
      {s.estimateHours != null && <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">{s.estimateHours}h</span>}
      <span className="hidden shrink-0 text-[11px] text-muted sm:inline">{STATUS_LABEL[s.status]}</span>
      <div className="flex shrink-0 -space-x-1">
        {s.assignees.slice(0, 3).map((a) => (
          <span key={a.user.id} title={a.user.name} className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-fg ring-2 ring-surface">
            {a.user.name.charAt(0).toUpperCase()}
          </span>
        ))}
      </div>
    </button>
  );
}

// Input en línea reutilizable (crear épica/historia).
function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!val.trim()) return setOpen(false);
    setBusy(true);
    try {
      await onAdd(val.trim());
      setVal("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand-soft">
        + {placeholder}
      </button>
    );
  return (
    <div className="flex gap-1.5 px-1 py-1">
      <input
        autoFocus
        value={val}
        disabled={busy}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-border-strong bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <Button onClick={submit} loading={busy} className="w-auto px-3 py-1.5 text-xs">
        Agregar
      </Button>
    </div>
  );
}

export function ProjectStructure({
  projectId,
  canEdit,
  canPlan,
  reloadKey,
  onOpenStory,
  onAddSprint,
  onChanged,
  clientView = false,
  canDeleteEpic = false,
}: {
  projectId: string;
  canEdit: boolean;
  canPlan: boolean;
  reloadKey: number;
  onOpenStory: (id: string) => void;
  onAddSprint: () => void;
  onChanged: () => void;
  // Vista de solo lectura para el cliente: avance de proyecto y sprints,
  // SIN bajar al detalle de historias de usuario.
  clientView?: boolean;
  // Eliminar épicas: solo admin/líder técnico.
  canDeleteEpic?: boolean;
}) {
  const [data, setData] = useState<Structure | null>(null);

  const load = useCallback(async () => {
    setData(await apiGet<Structure>(`/api/projects/${projectId}/structure`));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  async function addEpic(sprintId: string, title: string) {
    await apiSend("/api/epics", "POST", { projectId, sprintId, title });
    await load();
    onChanged();
  }
  async function addStory(epicId: string, title: string) {
    await apiSend("/api/stories", "POST", { projectId, epicId, title });
    await load();
    onChanged();
  }
  async function delEpic(id: string, title: string) {
    if (!confirm(`¿Eliminar la fase “${title}”? Sus actividades quedarán sin fase (no se borran).`)) return;
    await apiSend(`/api/epics/${id}`, "DELETE");
    await load();
    onChanged();
  }

  if (!data) return <p className="text-sm text-muted">Cargando estructura…</p>;

  const isEmpty = data.sprints.length === 0 && data.looseEpics.length === 0 && data.looseStories.length === 0;

  return (
    <div className="space-y-4">
      {canPlan && (
        <div className="flex justify-end">
          <Button onClick={onAddSprint} className="w-auto px-4">
            + Nuevo hito
          </Button>
        </div>
      )}

      {isEmpty && (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center text-sm text-muted">
          {clientView
            ? "Aún no hay avances para mostrar. En cuanto el equipo planifique el trabajo, verás aquí el progreso del proyecto y de cada hito."
            : (<>Organiza el proyecto en <strong>Hitos ▸ Fases ▸ Actividades</strong>. Empieza creando un hito.</>)}
        </div>
      )}

      {/* Avance del proyecto */}
      {!isEmpty && (() => {
        const all = [
          ...data.sprints.flatMap((sp) => sp.epics.flatMap((e) => e.stories)),
          ...data.looseEpics.flatMap((e) => e.stories),
          ...data.looseStories,
        ];
        const p = progressOf(all);
        return (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wide text-muted">Avance del proyecto</span>
              <span className="text-sm font-semibold text-brand">{p.pct}%</span>
            </div>
            <Progress pct={p.pct} className="h-2" />
            <p className="mt-1.5 text-xs text-muted">{p.done} de {p.total} actividades completadas</p>
          </div>
        );
      })()}

      {/* Sprints */}
      {data.sprints.map((sp) => {
        const sprintStories = sp.epics.flatMap((e) => e.stories);
        const sPr = progressOf(sprintStories);
        return (
          <section key={sp.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-fg">H</span>
              <div className="min-w-0">
                <div className="font-semibold">{sp.name}</div>
                <div className="text-xs text-muted">
                  {fmt(sp.startDate)} → {fmt(sp.endDate)}
                  {sp.goal && ` · ${sp.goal}`}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="hidden w-24 sm:block">
                  <Progress pct={sPr.pct} />
                </div>
                <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-muted">
                  {sPr.pct}% · {sPr.done}/{sPr.total}
                </span>
              </div>
            </header>

            {!clientView && (
            <div className="space-y-3 p-3">
              {sp.epics.length === 0 && <p className="px-1 text-xs text-muted">Sin fases en este hito.</p>}
              {sp.epics.map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-background/40">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span aria-hidden>📦</span>
                    <span className="font-medium">{e.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${PRIORITY_CLASSES[e.priority]}`}>{PRIORITY_LABELS[e.priority]}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="hidden w-16 sm:block">
                        <Progress pct={progressOf(e.stories).pct} />
                      </div>
                      <span className="text-xs text-muted">{progressOf(e.stories).pct}% · {e.stories.length}</span>
                      {canDeleteEpic && (
                        <button
                          onClick={() => delEpic(e.id, e.title)}
                          title="Eliminar fase"
                          className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-0.5 px-2 pb-2">
                    {e.stories.map((s) => (
                      <StoryRow key={s.id} s={s} onOpen={() => onOpenStory(s.id)} />
                    ))}
                    {canEdit && <InlineAdd placeholder="Actividad" onAdd={(v) => addStory(e.id, v)} />}
                  </div>
                </div>
              ))}
              {canPlan && <InlineAdd placeholder="Fase" onAdd={(v) => addEpic(sp.id, v)} />}
            </div>
            )}
          </section>
        );
      })}

      {/* Épicas sin sprint / historias sueltas (transición) — oculto al cliente */}
      {!clientView && (data.looseEpics.length > 0 || data.looseStories.length > 0) && (
        <section className="overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface">
          <header className="border-b border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-muted">
            Sin hito asignado
          </header>
          <div className="space-y-3 p-3">
            {data.looseEpics.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-background/40">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span aria-hidden>📦</span>
                  <span className="font-medium">{e.title}</span>
                  <span className="ml-auto text-xs text-muted">{e.stories.length} actividades</span>
                  {canDeleteEpic && (
                    <button
                      onClick={() => delEpic(e.id, e.title)}
                      title="Eliminar fase"
                      className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      🗑
                    </button>
                  )}
                </div>
                <div className="space-y-0.5 px-2 pb-2">
                  {e.stories.map((s) => (
                    <StoryRow key={s.id} s={s} onOpen={() => onOpenStory(s.id)} />
                  ))}
                </div>
              </div>
            ))}
            {data.looseStories.map((s) => (
              <StoryRow key={s.id} s={s} onOpen={() => onOpenStory(s.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
