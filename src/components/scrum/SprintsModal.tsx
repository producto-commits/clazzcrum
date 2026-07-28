"use client";

import { useState } from "react";
import { apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";
import type { Sprint } from "@/lib/scrumTypes";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("es");
}

type EditForm = { name: string; goal: string; capacity: string };

export function SprintsModal({
  projectId,
  sprints,
  open,
  canEdit,
  onClose,
  onChanged,
}: {
  projectId: string;
  sprints: Sprint[];
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  // Fechas ya no se piden aquí: las calcula el motor. Solo nombre, objetivo y capacidad.
  const [form, setForm] = useState({ name: "", goal: "", capacity: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Edición en línea: id del hito en edición y sus valores.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", goal: "", capacity: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend("/api/sprints", "POST", {
        projectId,
        name: form.name,
        goal: form.goal || null,
        capacity: form.capacity === "" ? null : Number(form.capacity),
      });
      setForm({ name: "", goal: "", capacity: "" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: Sprint) {
    setError(null);
    setEditingId(s.id);
    // El nombre "H-01 · Título" — dejamos el título editable sin el prefijo,
    // pero si el usuario quiere reescribir todo, también le funciona.
    const clean = s.name.replace(/^\s*(?:SP|H)-\d+\s*[·:.-]?\s*/i, "").trim();
    setEditForm({
      name: clean || s.name,
      goal: s.goal ?? "",
      capacity: s.capacity != null ? String(s.capacity) : "",
    });
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit(id: string) {
    setSavingEdit(true);
    setError(null);
    try {
      await apiSend(`/api/sprints/${id}`, "PATCH", {
        name: editForm.name,
        goal: editForm.goal || null,
        capacity: editForm.capacity === "" ? null : Number(editForm.capacity),
      });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(s: Sprint) {
    const activities = s._count?.stories ?? 0;
    const msg = activities > 0
      ? `¿Eliminar el hito “${s.name}”? Sus ${activities} actividad(es) quedarán sin hito (no se borran).`
      : `¿Eliminar el hito “${s.name}”? Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;
    setError(null);
    try {
      await apiSend(`/api/sprints/${s.id}`, "DELETE");
      if (editingId === s.id) setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Hitos" wide>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="mb-4 space-y-2">
        {sprints.length === 0 && <p className="text-sm text-muted">Aún no hay hitos.</p>}
        {sprints.map((s) => {
          const isEditing = editingId === s.id;
          if (isEditing) {
            return (
              <div key={s.id} className="rounded-lg border border-brand/40 bg-background p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted">
                  <span>Editando hito {s.name.match(/^(H|SP)-\d+/i)?.[0] ?? ""}</span>
                  <span>{fmt(s.startDate)} → {fmt(s.endDate)}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor={`en-${s.id}`}>Nombre</Label>
                    <Input
                      id={`en-${s.id}`}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Ej: Infraestructura + Integraciones"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`eg-${s.id}`}>Objetivo</Label>
                    <Textarea
                      id={`eg-${s.id}`}
                      value={editForm.goal}
                      onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`ec-${s.id}`}>Capacidad (opcional)</Label>
                    <Input
                      id={`ec-${s.id}`}
                      type="number"
                      value={editForm.capacity}
                      onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <Button
                    onClick={() => saveEdit(s.id)}
                    loading={savingEdit}
                    className="w-auto px-3 py-1.5 text-xs"
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div key={s.id} className="rounded-lg border border-border bg-background p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 font-medium">{s.name}</span>
                <span className="text-xs text-muted">
                  {fmt(s.startDate)} → {fmt(s.endDate)}
                </span>
                {canEdit && (
                  <>
                    <button
                      onClick={() => startEdit(s)}
                      title="Editar hito"
                      aria-label={`Editar hito ${s.name}`}
                      className="rounded-lg p-1 text-xs text-muted transition-colors hover:bg-brand-soft hover:text-brand"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => remove(s)}
                      title="Eliminar hito"
                      aria-label={`Eliminar hito ${s.name}`}
                      className="rounded-lg p-1 text-xs text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              {s.goal && <div className="mt-1 text-xs text-muted">{s.goal}</div>}
              <div className="mt-1 text-xs text-muted">
                {s._count?.stories ?? 0} actividades {s.capacity != null && `· capacidad ${s.capacity} pts`}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <form onSubmit={create} className="space-y-3 border-t border-border pt-4">
          <div>
            <Label htmlFor="sname">Nombre *</Label>
            <Input
              id="sname"
              required
              placeholder="Ej: Infraestructura + Integraciones"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted">
              El código (H-01, H-02…) se asigna automáticamente. Solo escribe el nombre.
            </p>
          </div>
          <div>
            <Label htmlFor="sgoal">Objetivo</Label>
            <Textarea id="sgoal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="scap">Capacidad (opcional)</Label>
            <Input id="scap" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <p className="mt-1 text-xs text-muted">
              Las fechas del hito las calcula automáticamente el motor a partir de las actividades y de su fecha de inicio del proyecto.
            </p>
          </div>
          <Button type="submit" loading={saving}>
            Crear hito
          </Button>
        </form>
      )}
    </Modal>
  );
}
