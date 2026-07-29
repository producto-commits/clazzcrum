"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea, Select } from "@/components/ui/Inputs";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoveProjectModal } from "@/components/scrum/MoveProjectModal";

type Project = {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string };
  _count: { stories: number; sprints: number; epics: number };
};
type ClientOpt = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planeación",
  ACTIVE: "Activo",
  ON_HOLD: "En pausa",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export default function ProjectsPage() {
  const { can } = useMe();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", name: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCreate = can("create", "project");
  const canEditProject = can("edit", "project");
  const [movingProject, setMovingProject] = useState<Project | null>(null);

  async function load() {
    setLoading(true);
    try {
      setProjects(await apiGet<Project[]>("/api/projects"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function openModal() {
    setError(null);
    try {
      const cs = await apiGet<ClientOpt[]>("/api/clients");
      setClients(cs);
      setForm((f) => ({ ...f, clientId: cs[0]?.id ?? "" }));
    } catch {
      /* sin permiso de clientes */
    }
    setOpen(true);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const p = await apiSend<Project>("/api/projects", "POST", form);
      setOpen(false);
      setForm({ clientId: "", name: "", description: "" });
      await load();
      window.location.href = `/projects/${p.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
        {canCreate && (
          <Button onClick={openModal} className="w-auto px-4">
            + Nuevo proyecto
          </Button>
        )}
      </div>

      {loading ? (
        <SkeletonCards />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Aún no hay proyectos"
          description={
            canCreate
              ? "Crea tu primer proyecto para empezar a planear actividades e hitos."
              : "Cuando te asignen un proyecto, aparecerá aquí."
          }
          action={
            canCreate ? (
              <Button onClick={openModal} className="w-auto px-4">
                + Nuevo proyecto
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="relative rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40"
            >
              <Link href={`/projects/${p.id}`} className="block">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate pr-2 font-medium">{p.name}</span>
                  <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-muted">
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted">{p.client.name}</div>
                <div className="mt-3 flex gap-2 text-xs text-muted">
                  <span className="rounded-full bg-background px-2 py-0.5">{p._count.stories} actividades</span>
                  <span className="rounded-full bg-background px-2 py-0.5">{p._count.sprints} hitos</span>
                </div>
              </Link>
              {canEditProject && (
                <button
                  onClick={() => setMovingProject(p)}
                  title={`Mover ${p.name} a otro cliente`}
                  aria-label={`Mover ${p.name} a otro cliente`}
                  className="absolute bottom-3 right-3 z-10 rounded-lg border border-border bg-background/90 p-1.5 text-muted transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7" />
                    <path d="M8 7h9v9" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {movingProject && (
        <MoveProjectModal
          projectId={movingProject.id}
          currentClient={movingProject.client}
          open={movingProject !== null}
          onClose={() => setMovingProject(null)}
          onMoved={() => { setMovingProject(null); load(); }}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo proyecto">
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={create} className="space-y-3">
          <div>
            <Label htmlFor="client">Cliente *</Label>
            <Select
              id="client"
              required
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {clients.length === 0 && (
              <p className="mt-1 text-xs text-warning">Primero crea un cliente.</p>
            )}
          </div>
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="desc">Descripción</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <Button type="submit" loading={saving} disabled={!form.clientId}>
            Crear proyecto
          </Button>
        </form>
      </Modal>
    </div>
  );
}
