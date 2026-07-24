"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Button } from "@/components/ui/Field";
import { Select } from "@/components/ui/Inputs";
import { KanbanBoard } from "./KanbanBoard";
import { StoryPanel } from "./StoryPanel";
import { NewStoryModal } from "./NewStoryModal";
import { SprintsModal } from "./SprintsModal";
import { ProjectMetricsModal } from "./ProjectMetricsModal";
import { CompleteStoryModal } from "./CompleteStoryModal";
import { ProjectStructure } from "./ProjectStructure";
import { STORY_COLUMNS, type Story, type StoryStatus, type Sprint, type Epic, type UserOpt } from "@/lib/scrumTypes";

// ¿La historia cae/solapa el período elegido? (por sus fechas planeadas)
function inPeriod(s: Story, period: "" | "day" | "week" | "month"): boolean {
  if (!period) return true;
  const now = new Date();
  let start: Date;
  let end: Date;
  if (period === "day") {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    end = new Date(start); end.setDate(end.getDate() + 1);
  } else if (period === "week") {
    const dow = (now.getDay() + 6) % 7; // lunes = 0
    start = new Date(now); start.setDate(now.getDate() - dow); start.setHours(0, 0, 0, 0);
    end = new Date(start); end.setDate(start.getDate() + 7);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  const a = s.startDate ?? s.estimatedEnd;
  const b = s.estimatedEnd ?? s.startDate;
  if (!a || !b) return false; // sin fechas → no aparece al filtrar por período
  return new Date(a) < end && new Date(b) >= start;
}

type Project = {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string };
  epics: Epic[];
  sprints: Sprint[];
};

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { me, can } = useMe();
  // El cliente ve un resumen de avance de solo lectura (proyecto + sprints),
  // sin tablero, sin herramientas del equipo y sin bajar a las historias.
  const isClient = me?.roles.some((r) => r.key === "client") ?? false;
  const [project, setProject] = useState<Project | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"estructura" | "tablero">("estructura");
  const [structureKey, setStructureKey] = useState(0);
  const [filters, setFilters] = useState({ sprintId: "", assigneeId: "", priority: "", q: "" });
  const [period, setPeriod] = useState<"" | "day" | "week" | "month">("");
  const [visStatuses, setVisStatuses] = useState<StoryStatus[]>(STORY_COLUMNS.map((c) => c.key));
  const [openNew, setOpenNew] = useState(false);
  const [openSprints, setOpenSprints] = useState(false);
  const [openMetrics, setOpenMetrics] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [completeStory, setCompleteStory] = useState<{ id: string; title: string } | null>(null);

  // Recarga todo lo dependiente de la estructura (contadores, tablero, árbol).
  const refreshAll = useCallback(() => {
    setStructureKey((k) => k + 1);
    loadStories();
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canEditStory = can("edit", "story");
  const canCreateStory = can("create", "story");
  const canPlan = can("create", "sprint");
  // Eliminar historias/épicas: solo admin y líder técnico (permiso delete).
  const canDeleteStory = can("delete", "story");
  const canDeleteEpic = can("delete", "epic");

  const loadProject = useCallback(async () => {
    const p = await apiGet<Project>(`/api/projects/${projectId}`);
    setProject(p);
  }, [projectId]);

  const loadStories = useCallback(async () => {
    const qs = new URLSearchParams({ projectId });
    if (filters.sprintId) qs.set("sprintId", filters.sprintId);
    if (filters.assigneeId) qs.set("assigneeId", filters.assigneeId);
    if (filters.priority) qs.set("priority", filters.priority);
    if (filters.q) qs.set("q", filters.q);
    setStories(await apiGet<Story[]>(`/api/stories?${qs.toString()}`));
  }, [projectId, filters]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadProject(),
          apiGet<UserOpt[]>("/api/users").then(setUsers).catch(() => setUsers([])),
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProject]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  async function move(storyId: string, status: StoryStatus) {
    // Pasar a "Completado" exige evidencia → abrir el modal en vez de mover directo.
    if (status === "DONE") {
      const st = stories.find((s) => s.id === storyId);
      if (st) setCompleteStory({ id: st.id, title: st.title });
      return;
    }
    const prev = stories;
    setStories((cur) => cur.map((s) => (s.id === storyId ? { ...s, status } : s)));
    try {
      await apiSend(`/api/stories/${storyId}`, "PATCH", { status });
    } catch {
      setStories(prev); // revertir si falla
    }
  }

  if (loading || !project) {
    return <p className="text-sm text-muted">Cargando proyecto…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <Link href="/projects" className="text-xs text-muted hover:underline">
            ← Proyectos
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted">{project.client.name}</p>
        </div>
        {!isClient && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" className="w-auto px-3" onClick={() => setOpenMetrics(true)}>
              Métricas
            </Button>
            <Button variant="ghost" className="w-auto px-3" onClick={() => setOpenSprints(true)}>
              Sprints ({project.sprints.length})
            </Button>
            {canCreateStory && (
              <Button className="w-auto px-4" onClick={() => setOpenNew(true)}>
                + Historia
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pestañas — el cliente solo ve el resumen de avance */}
      {!isClient && (
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {(
            [
              ["estructura", "Estructura"],
              ["tablero", "Tablero"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                tab === key ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isClient || tab === "estructura" ? (
        <ProjectStructure
          projectId={projectId}
          canEdit={canEditStory}
          canPlan={canPlan}
          reloadKey={structureKey}
          onOpenStory={(sid) => setSelected(sid)}
          onAddSprint={() => setOpenSprints(true)}
          onChanged={refreshAll}
          clientView={isClient}
          canDeleteEpic={canDeleteEpic}
        />
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="Buscar…"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              className="rounded-lg border border-border-strong bg-background px-3 py-1.5 text-sm"
            />
            <Select value={filters.sprintId} onChange={(e) => setFilters({ ...filters, sprintId: e.target.value })} className="w-auto">
              <option value="">Todos los sprints</option>
              <option value="none">Sin sprint</option>
              {project.sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {users.length > 0 && (
              <Select value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })} className="w-auto">
                <option value="">Todos los asignados</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            )}
            <Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="w-auto">
              <option value="">Toda prioridad</option>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </Select>
            <Select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="w-auto">
              <option value="">Cualquier fecha</option>
              <option value="day">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
            </Select>
          </div>

          {/* Filtro por estados (mostrar/ocultar columnas) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Estados:</span>
            {STORY_COLUMNS.map((c) => {
              const on = visStatuses.includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() =>
                    setVisStatuses((prev) => (on ? prev.filter((s) => s !== c.key) : [...prev, c.key]))
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    on ? "border-brand bg-brand-soft text-brand" : "border-border text-muted line-through"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
            {visStatuses.length !== STORY_COLUMNS.length && (
              <button onClick={() => setVisStatuses(STORY_COLUMNS.map((c) => c.key))} className="text-xs text-brand hover:underline">
                Mostrar todos
              </button>
            )}
          </div>

          <KanbanBoard
            stories={stories.filter((s) => inPeriod(s, period))}
            onMove={move}
            onCardClick={(s) => setSelected(s.id)}
            canEdit={canEditStory}
            visibleStatuses={visStatuses}
          />
        </>
      )}

      {selected && (
        <StoryPanel
          storyId={selected}
          sprints={project.sprints}
          epics={project.epics}
          users={users}
          canEdit={canEditStory}
          canDelete={canDeleteStory}
          onClose={() => setSelected(null)}
          onChanged={refreshAll}
        />
      )}

      <NewStoryModal
        projectId={projectId}
        sprints={project.sprints}
        epics={project.epics}
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreated={refreshAll}
      />
      <SprintsModal
        projectId={projectId}
        sprints={project.sprints}
        open={openSprints}
        canEdit={canPlan}
        onClose={() => setOpenSprints(false)}
        onChanged={refreshAll}
      />
      <ProjectMetricsModal
        projectId={projectId}
        sprints={project.sprints}
        open={openMetrics}
        onClose={() => setOpenMetrics(false)}
      />
      <CompleteStoryModal
        storyId={completeStory?.id ?? null}
        storyTitle={completeStory?.title}
        open={completeStory !== null}
        onClose={() => setCompleteStory(null)}
        onDone={refreshAll}
      />
    </div>
  );
}
