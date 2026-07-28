"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Select, Textarea } from "@/components/ui/Inputs";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  client: { id: string; name: string };
};
type ClientOpt = { id: string; name: string };

const STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: "PLANNING", label: "Planeación" },
  { key: "ACTIVE", label: "Activo" },
  { key: "ON_HOLD", label: "En pausa" },
  { key: "COMPLETED", label: "Completado" },
  { key: "CANCELLED", label: "Cancelado" },
];

export function EditProjectModal({
  project,
  open,
  onClose,
  onSaved,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    clientId: project.client.id,
  });
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      clientId: project.client.id,
    });
    setError(null);
  }, [project]);

  useEffect(() => {
    apiGet<ClientOpt[]>("/api/clients").then(setClients).catch(() => setClients([]));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend(`/api/projects/${project.id}`, "PATCH", {
        name: form.name,
        description: form.description || null,
        status: form.status,
        clientId: form.clientId,
      });
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar proyecto">
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={save} className="space-y-3">
        <div>
          <Label htmlFor="pn">Nombre *</Label>
          <Input id="pn" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="pd">Descripción</Label>
          <Textarea id="pd" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ps">Estado</Label>
            <Select id="ps" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pc">Cliente</Label>
            <Select id="pc" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </form>
    </Modal>
  );
}
