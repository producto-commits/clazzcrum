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

  return (
    <Modal open={open} onClose={onClose} title="Hitos" wide>
      <div className="mb-4 space-y-2">
        {sprints.length === 0 && <p className="text-sm text-muted">Aún no hay hitos.</p>}
        {sprints.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-background p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted">
                {fmt(s.startDate)} → {fmt(s.endDate)}
              </span>
            </div>
            {s.goal && <div className="mt-1 text-xs text-muted">{s.goal}</div>}
            <div className="mt-1 text-xs text-muted">
              {s._count?.stories ?? 0} actividades {s.capacity != null && `· capacidad ${s.capacity} pts`}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={create} className="space-y-3 border-t border-border pt-4">
          {error && <Alert kind="error">{error}</Alert>}
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
