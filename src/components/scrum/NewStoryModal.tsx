"use client";

import { useState } from "react";
import { apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Select } from "@/components/ui/Inputs";
import type { Sprint, Epic } from "@/lib/scrumTypes";

export function NewStoryModal({
  projectId,
  sprints,
  epics,
  open,
  onClose,
  onCreated,
}: {
  projectId: string;
  sprints: Sprint[];
  epics: Epic[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    priority: "MEDIUM",
    epicId: "",
    sprintId: "",
    estimateHours: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend("/api/stories", "POST", {
        projectId,
        title: form.title,
        priority: form.priority,
        epicId: form.epicId || null,
        sprintId: form.sprintId || null,
        estimateHours: form.estimateHours === "" ? null : Number(form.estimateHours),
        // Sin estado: entra en Backlog por defecto.
      });
      setForm({ title: "", priority: "MEDIUM", epicId: "", sprintId: "", estimateHours: "" });
      onClose();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva actividad">
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={create} className="space-y-3">
        <div>
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ej: Login con Google"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="priority">Prioridad</Label>
            <Select
              id="priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="hours">Horas estimadas</Label>
            <Input
              id="hours"
              type="number"
              min="0"
              value={form.estimateHours}
              onChange={(e) => setForm({ ...form, estimateHours: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="epic">Fase</Label>
            <Select id="epic" value={form.epicId} onChange={(e) => setForm({ ...form, epicId: e.target.value })}>
              <option value="">— sin fase —</option>
              {epics.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sprint">Hito</Label>
            <Select id="sprint" value={form.sprintId} onChange={(e) => setForm({ ...form, sprintId: e.target.value })}>
              <option value="">— backlog —</option>
              {sprints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit" loading={saving}>
          Crear actividad
        </Button>
      </form>
    </Modal>
  );
}
