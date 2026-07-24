"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Button } from "@/components/ui/Field";
import { Select, Textarea } from "@/components/ui/Inputs";
import { Attachments } from "@/components/ui/Attachments";
import { CompleteStoryModal } from "./CompleteStoryModal";
import {
  STORY_COLUMNS,
  storyCompliance,
  COMPLIANCE_META,
  type Sprint,
  type Epic,
  type UserOpt,
} from "@/lib/scrumTypes";

const PRIORITIES = [
  { v: "LOW", l: "Baja" },
  { v: "MEDIUM", l: "Media" },
  { v: "HIGH", l: "Alta" },
  { v: "CRITICAL", l: "Crítica" },
];

const toDateInput = (v: string | null) => (v ? v.slice(0, 10) : "");

type Detail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  storyPoints: number | null;
  estimateHours: number | null;
  spentHours: number;
  tags: string[];
  epicId: string | null;
  sprintId: string | null;
  startDate: string | null;
  estimatedEnd: string | null;
  actualEnd: string | null;
  blockReason: string | null;
  blockedAt: string | null;
  blockedDays: number;
  completionEvidence: string | null;
  assignees: { user: { id: string; name: string } }[];
  tasks: { id: string; title: string; done: boolean; assignee: { id: string; name: string } | null }[];
  acceptanceCriteria: { id: string; text: string; done: boolean }[];
  comments: { id: string; body: string; createdAt: string; user: { id: string; name: string } }[];
};

export function StoryPanel({
  storyId,
  sprints,
  epics,
  users,
  canEdit,
  canDelete = false,
  onClose,
  onChanged,
}: {
  storyId: string;
  sprints: Sprint[];
  epics: Epic[];
  users: UserOpt[];
  canEdit: boolean;
  // Eliminar la historia: solo admin/líder técnico.
  canDelete?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newCriterion, setNewCriterion] = useState("");
  const [newComment, setNewComment] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [attKey, setAttKey] = useState(0);

  async function load() {
    const detail = await apiGet<Detail>(`/api/stories/${storyId}`);
    setD(detail);
    setTagsText(detail.tags.join(", "));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  function set<K extends keyof Detail>(k: K, v: Detail[K]) {
    setD((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function saveFields() {
    if (!d) return;
    setSaving(true);
    try {
      await apiSend(`/api/stories/${d.id}`, "PATCH", {
        title: d.title,
        description: d.description,
        priority: d.priority,
        // El estado se cambia normalmente aquí, EXCEPTO pasar a Completado,
        // que exige evidencia (se maneja con el modal). Si sigue en DONE, se envía DONE.
        status: d.status,
        estimateHours: d.estimateHours,
        spentHours: d.spentHours,
        epicId: d.epicId || null,
        sprintId: d.sprintId || null,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        assigneeIds: d.assignees.map((a) => a.user.id),
      });
      await load();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  // Selección de estado: pasar a "Completado" exige evidencia (abre el modal).
  function onStatusChange(value: string) {
    if (!d) return;
    if (value === "DONE" && d.status !== "DONE") {
      setCompleteOpen(true);
      return;
    }
    if (value === "BLOCKED" && d.status !== "BLOCKED") {
      const reason = window.prompt("¿Cuál es el motivo del bloqueo?");
      if (!reason || !reason.trim()) return;
      apiSend(`/api/stories/${d.id}`, "PATCH", { status: "BLOCKED", blockReason: reason.trim() })
        .then(() => { load(); onChanged(); });
      return;
    }
    set("status", value);
  }

  function toggleAssignee(u: UserOpt) {
    if (!d) return;
    const has = d.assignees.some((a) => a.user.id === u.id);
    set(
      "assignees",
      has
        ? d.assignees.filter((a) => a.user.id !== u.id)
        : [...d.assignees, { user: { id: u.id, name: u.name } }],
    );
  }

  async function addTask() {
    if (!d || !newTask.trim()) return;
    await apiSend(`/api/stories/${d.id}/tasks`, "POST", { title: newTask.trim() });
    setNewTask("");
    await load();
    onChanged();
  }
  async function toggleTask(id: string, done: boolean) {
    await apiSend(`/api/tasks/${id}`, "PATCH", { done });
    await load();
    onChanged();
  }
  async function delTask(id: string) {
    await apiSend(`/api/tasks/${id}`, "DELETE");
    await load();
    onChanged();
  }

  async function addCriterion() {
    if (!d || !newCriterion.trim()) return;
    await apiSend(`/api/stories/${d.id}/criteria`, "POST", { text: newCriterion.trim() });
    setNewCriterion("");
    await load();
    onChanged();
  }
  async function toggleCriterion(id: string, done: boolean) {
    await apiSend(`/api/criteria/${id}`, "PATCH", { done });
    await load();
    onChanged();
  }
  async function delCriterion(id: string) {
    await apiSend(`/api/criteria/${id}`, "DELETE");
    await load();
    onChanged();
  }

  async function addComment() {
    if (!d || !newComment.trim()) return;
    await apiSend(`/api/stories/${d.id}/comments`, "POST", { body: newComment.trim() });
    setNewComment("");
    await load();
    onChanged();
  }

  async function deleteStory() {
    if (!d) return;
    if (!confirm(`¿Eliminar la historia “${d.title}”? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    try {
      await apiSend(`/api/stories/${d.id}`, "DELETE");
      onClose();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-surface">
        {!d ? (
          <div className="p-6 text-sm text-muted">Cargando…</div>
        ) : (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <input
                disabled={!canEdit}
                value={d.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full rounded-lg border border-transparent bg-transparent text-lg font-semibold outline-none hover:border-border focus:border-brand disabled:cursor-default"
              />
              <button onClick={onClose} className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2">
                ✕
              </button>
            </div>

            {/* Estado de cumplimiento + acción de completar */}
            {(() => {
              const c = storyCompliance(d.status, d.estimatedEnd, d.actualEnd);
              return (
                <div className="flex flex-wrap items-center gap-2">
                  {c !== "none" && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COMPLIANCE_META[c].cls}`}>
                      {(c === "overdue" || c === "late") && "⚠ "}
                      {COMPLIANCE_META[c].label}
                    </span>
                  )}
                  {canEdit && d.status !== "DONE" && (
                    <Button className="ml-auto w-auto px-3 py-1.5 text-xs" onClick={() => setCompleteOpen(true)}>
                      ✓ Marcar completada
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Descripción */}
            <div className="text-sm">
              <label className="mb-1 block text-xs text-muted">Descripción</label>
              <Textarea
                disabled={!canEdit}
                value={d.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Detalle de la actividad, contexto, notas técnicas…"
              />
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="mb-1 block text-xs text-muted">Estado</label>
                <Select disabled={!canEdit} value={d.status} onChange={(e) => onStatusChange(e.target.value)}>
                  {STORY_COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Prioridad</label>
                <Select disabled={!canEdit} value={d.priority} onChange={(e) => set("priority", e.target.value)}>
                  {PRIORITIES.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.l}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Fase</label>
                <Select disabled={!canEdit} value={d.epicId ?? ""} onChange={(e) => set("epicId", e.target.value || null)}>
                  <option value="">— sin fase —</option>
                  {epics.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Hito</label>
                <Select disabled={!canEdit} value={d.sprintId ?? ""} onChange={(e) => set("sprintId", e.target.value || null)}>
                  <option value="">— backlog —</option>
                  {sprints.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Horas estimadas</label>
                <input
                  type="number"
                  min="0"
                  disabled={!canEdit}
                  value={d.estimateHours ?? ""}
                  onChange={(e) => set("estimateHours", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-70"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Horas reales</label>
                <input
                  type="number"
                  min="0"
                  disabled={!canEdit}
                  value={d.spentHours}
                  onChange={(e) => set("spentHours", Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-70"
                />
              </div>
            </div>

            {/* Fechas calculadas por el motor de planificación (solo lectura) */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="mb-1 block text-xs text-muted">Inicio probable (calculado)</label>
                <input type="date" disabled readOnly value={toDateInput(d.startDate)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 opacity-70" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Cierre probable (calculado)</label>
                <input type="date" disabled readOnly value={toDateInput(d.estimatedEnd)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 opacity-70" />
              </div>
              {d.actualEnd && (
                <div className="col-span-2 text-xs text-muted">
                  Completada el{" "}
                  <span className="font-medium text-foreground">
                    {new Date(d.actualEnd).toLocaleDateString("es")}
                  </span>
                </div>
              )}
            </div>

            {/* Etiquetas */}
            <div className="text-sm">
              <label className="mb-1 block text-xs text-muted">Etiquetas (separadas por coma)</label>
              <input
                disabled={!canEdit}
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-70"
              />
            </div>

            {/* Responsable(s) */}
            {users.length > 0 && (
              <div className="text-sm">
                <label className="mb-1 block text-xs text-muted">Responsable(s)</label>
                <div className="flex flex-wrap gap-2">
                  {users.map((u) => {
                    const on = d.assignees.some((a) => a.user.id === u.id);
                    return (
                      <button
                        key={u.id}
                        disabled={!canEdit}
                        onClick={() => toggleAssignee(u)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${
                          on ? "border-brand bg-brand/10 text-brand" : "border-border text-muted"
                        } disabled:opacity-60`}
                      >
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {canEdit && (
              <Button onClick={saveFields} loading={saving} className="w-auto self-start px-5">
                Guardar cambios
              </Button>
            )}

            {/* Bloqueo: motivo + días acumulados (solo lectura) */}
            {(d.status === "BLOCKED" || d.blockedDays > 0) && (
              <section className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
                <h4 className="mb-1 text-sm font-semibold text-danger">Bloqueo</h4>
                {d.blockReason && <p className="whitespace-pre-wrap">{d.blockReason}</p>}
                <p className="mt-1 text-xs text-muted">
                  Días en bloqueo:{" "}
                  <span className="font-semibold text-foreground">
                    {(d.blockedDays + (d.status === "BLOCKED" && d.blockedAt ? (Date.now() - new Date(d.blockedAt).getTime()) / 86400000 : 0)).toFixed(1)}
                  </span>{" "}
                  (automático)
                </p>
              </section>
            )}

            {/* Evidencia de cumplimiento */}
            {d.completionEvidence && (
              <section className="rounded-xl border border-success/30 bg-success/5 p-3">
                <h4 className="mb-1 text-sm font-semibold text-success">Evidencia de cumplimiento</h4>
                <p className="whitespace-pre-wrap text-sm">{d.completionEvidence}</p>
              </section>
            )}

            {/* Adjuntos */}
            <section>
              <h4 className="mb-2 text-sm font-semibold">Adjuntos y evidencia</h4>
              <Attachments entityType="story" entityId={d.id} canEdit={canEdit} reloadKey={attKey} />
            </section>

            {/* Criterios de aceptación */}
            <section>
              <h4 className="mb-2 text-sm font-semibold">Criterios de aceptación (DoD)</h4>
              <div className="space-y-1">
                {d.acceptanceCriteria.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.done}
                      disabled={!canEdit}
                      onChange={(e) => toggleCriterion(c.id, e.target.checked)}
                    />
                    <span className={c.done ? "text-muted line-through" : ""}>{c.text}</span>
                    {canEdit && (
                      <button onClick={() => delCriterion(c.id)} className="ml-auto text-xs text-muted hover:text-danger">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newCriterion}
                    onChange={(e) => setNewCriterion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCriterion()}
                    placeholder="Nuevo criterio…"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                  />
                  <Button onClick={addCriterion} variant="ghost" className="w-auto px-3">
                    +
                  </Button>
                </div>
              )}
            </section>

            {/* Tareas */}
            <section>
              <h4 className="mb-2 text-sm font-semibold">Subtareas</h4>
              <div className="space-y-1">
                {d.tasks.map((tk) => (
                  <div key={tk.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={tk.done}
                      disabled={!canEdit}
                      onChange={(e) => toggleTask(tk.id, e.target.checked)}
                    />
                    <span className={tk.done ? "text-muted line-through" : ""}>{tk.title}</span>
                    {tk.assignee && <span className="text-xs text-muted">· {tk.assignee.name}</span>}
                    {canEdit && (
                      <button onClick={() => delTask(tk.id)} className="ml-auto text-xs text-muted hover:text-danger">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTask()}
                    placeholder="Nueva subtarea…"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                  />
                  <Button onClick={addTask} variant="ghost" className="w-auto px-3">
                    +
                  </Button>
                </div>
              )}
            </section>

            {/* Comentarios */}
            <section>
              <h4 className="mb-2 text-sm font-semibold">Comentarios</h4>
              <div className="space-y-2">
                {d.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border bg-background p-2 text-sm">
                    <div className="mb-0.5 text-xs text-muted">{c.user.name}</div>
                    {c.body}
                  </div>
                ))}
                {d.comments.length === 0 && <p className="text-xs text-muted">Sin comentarios.</p>}
              </div>
              <div className="mt-2 flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario…"
                  className="min-h-[40px] flex-1"
                />
                <Button onClick={addComment} variant="ghost" className="w-auto self-end px-3">
                  Enviar
                </Button>
              </div>
            </section>

            {/* Zona de peligro — eliminar (solo admin/líder técnico) */}
            {canDelete && (
              <section className="mt-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-danger">Eliminar actividad</h4>
                    <p className="text-xs text-muted">Se borra la actividad y todo su contenido. No se puede deshacer.</p>
                  </div>
                  <button
                    onClick={deleteStory}
                    disabled={saving}
                    className="w-auto rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <CompleteStoryModal
        storyId={d ? d.id : null}
        storyTitle={d?.title}
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onDone={async () => {
          setAttKey((k) => k + 1);
          await load();
          onChanged();
        }}
      />
    </div>
  );
}
