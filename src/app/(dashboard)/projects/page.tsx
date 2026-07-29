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
import { ProjectStatusBadge } from "@/components/scrum/ProjectStatusBadge";

type Assignment = {
  userId: string;
  dedicationPct: number;
  priority: number;
  user: { id: string; name: string; jobTitle: string | null };
};
type Project = {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string };
  assignments: Assignment[];
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
                  <span className="shrink-0">
                    <ProjectStatusBadge projectId={p.id} status={p.status} />
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted">{p.client.name}</div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted">
                  <span className="rounded-full bg-background px-2 py-0.5">{p._count.stories} actividades</span>
                  <span className="rounded-full bg-background px-2 py-0.5">{p._count.sprints} hitos</span>
                </div>
                {/* Equipo: quién trabaja aquí (de mayor a menor dedicación). */}
                {p.assignments.length > 0 ? (
                  <div className="mt-3 border-t border-border pt-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted">
                      <span>Equipo</span>
                      <span>{p.assignments.length} persona{p.assignments.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pr-8">
                      {p.assignments.slice(0, 4).map((a, idx) => (
                        <span
                          key={a.userId}
                          className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
                            idx === 0
                              ? "border-brand/40 bg-brand-soft text-brand"
                              : "border-border bg-background text-muted"
                          }`}
                          title={`${a.user.name}${a.user.jobTitle ? " · " + a.user.jobTitle : ""} — ${a.dedicationPct}%`}
                        >
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                            idx === 0 ? "bg-brand text-brand-fg" : "bg-surface-2 text-foreground"
                          }`}>
                            {a.user.name.split(" ").slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("")}
                          </span>
                          <span className="max-w-[9rem] truncate">{a.user.name}</span>
                          <span className="font-mono opacity-80">{a.dedicationPct}%</span>
                        </span>
                      ))}
                      {p.assignments.length > 4 && (
                        <span className="text-[11px] text-muted">+{p.assignments.length - 4}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 border-t border-border pt-2.5 pr-8">
                    <span className="text-[11px] text-muted">Sin equipo asignado</span>
                  </div>
                )}
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
