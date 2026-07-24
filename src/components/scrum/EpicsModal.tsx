"use client";

import { useState } from "react";
import { apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea, Select, PRIORITY_LABELS } from "@/components/ui/Inputs";
import type { Epic } from "@/lib/scrumTypes";

export function EpicsModal({
  projectId,
  epics,
  open,
  canEdit,
  onClose,
  onChanged,
}: {
  projectId: string;
  epics: Epic[];
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend("/api/epics", "POST", {
        projectId,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
      });
      setForm({ title: "", description: "", priority: "MEDIUM" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Fases" wide>
      <div className="mb-4 space-y-2">
        {epics.length === 0 && <p className="text-sm text-muted">Aún no hay fases.</p>}
        {epics.map((ep) => (
          <div key={ep.id} className="rounded-lg border border-border bg-background p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{ep.title}</span>
              <span className="text-xs text-muted">{PRIORITY_LABELS[ep.priority] ?? ep.priority}</span>
            </div>
            {ep.description && <div className="mt-1 text-xs text-muted">{ep.description}</div>}
            <div className="mt-1 text-xs text-muted">{ep._count?.stories ?? 0} actividades</div>
          </div>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={create} className="space-y-3 border-t border-border pt-4">
          {error && <Alert kind="error">{error}</Alert>}
          <div>
            <Label htmlFor="etitle">Título *</Label>
            <Input id="etitle" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="edesc">Descripción</Label>
            <Textarea id="edesc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="eprio">Prioridad</Label>
            <Select id="eprio" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </Select>
          </div>
          <Button type="submit" loading={saving}>
            Crear fase
          </Button>
        </form>
      )}
    </Modal>
  );
}
