"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Select } from "@/components/ui/Inputs";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Asg = { projectId: string; dedicationPct: number; priority: number; project?: { name: string } };
type Row = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  dailyHours: number;
  roles: { role: { key: string; name: string } }[];
  assignments: Asg[];
};
type ProjectOpt = { id: string; name: string; client?: { name: string } };

const ROLES = [
  { key: "admin", name: "Administrador" },
  { key: "tech_lead", name: "Líder técnico" },
  { key: "developer", name: "Desarrollador" },
  { key: "client", name: "Cliente" },
];

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-brand/15 text-brand",
  tech_lead: "bg-info/15 text-info",
  developer: "bg-accent-2/15 text-accent-2",
  client: "bg-muted/15 text-muted",
};

const emptyCreate = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  roleKey: "developer",
  jobTitle: "",
};

type EditForm = {
  name: string;
  email: string;
  jobTitle: string;
  roleKey: string;
  isActive: boolean;
  password: string;
  dailyHours: string;
  assignments: Asg[];
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [create, setCreate] = useState({ ...emptyCreate });
  const [editing, setEditing] = useState<Row | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [assignQuery, setAssignQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      setUsers(await apiGet<Row[]>("/api/admin/users"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiGet<ProjectOpt[]>("/api/projects").then(setProjects).catch(() => setProjects([]));
  }, []);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend("/api/admin/users", "POST", create);
      setOpenCreate(false);
      setCreate({ ...emptyCreate });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u: Row) {
    setError(null);
    setEditing(u);
    setEdit({
      name: u.name,
      email: u.email,
      jobTitle: u.jobTitle ?? "",
      roleKey: u.roles[0]?.role.key ?? "developer",
      isActive: u.isActive,
      password: "",
      dailyHours: String(u.dailyHours ?? 8),
      assignments: (u.assignments ?? []).map((a) => ({ ...a })),
    });
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !edit) return;
    setError(null);
    setSaving(true);
    try {
      await apiSend(`/api/admin/users/${editing.id}`, "PATCH", {
        name: edit.name,
        email: edit.email,
        jobTitle: edit.jobTitle,
        roleKey: edit.roleKey,
        isActive: edit.isActive,
        dailyHours: Number(edit.dailyHours) || 8,
        assignments: edit.assignments.map((a) => ({
          projectId: a.projectId,
          dedicationPct: a.dedicationPct,
          priority: a.priority,
        })),
        ...(edit.password ? { password: edit.password } : {}),
      });
      setEditing(null);
      setEdit(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(u: Row) {
    if (!confirm(`¿Eliminar a ${u.name}? Se borra su cuenta y no se puede deshacer.`)) return;
    setError(null);
    try {
      await apiSend(`/api/admin/users/${u.id}`, "DELETE");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted">Miembros del equipo de trabajo y sus roles.</p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="w-auto px-4">
          + Nuevo miembro
        </Button>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : users.length === 0 ? (
        <EmptyState
          title="Aún no hay miembros"
          description="Crea las cuentas de tu equipo con su rol y cargo."
          action={
            <Button onClick={() => setOpenCreate(true)} className="w-auto px-4">
              + Nuevo miembro
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {users.map((u) => {
            const roleKey = u.roles[0]?.role.key ?? "";
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 last:border-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {u.name.split(" ").slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("")}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    {!u.isActive && (
                      <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] text-danger">Inactivo</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {u.email}
                    {u.jobTitle && ` · ${u.jobTitle}`}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[roleKey] ?? ""}`}>
                    {u.roles[0]?.role.name ?? "Sin rol"}
                  </span>
                  <Button variant="ghost" onClick={() => startEdit(u)} className="w-auto px-3 py-1.5 text-xs">
                    Editar
                  </Button>
                  <button
                    onClick={() => removeUser(u)}
                    title="Eliminar"
                    aria-label={`Eliminar ${u.name}`}
                    className="rounded-lg p-1.5 text-xs text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Crear miembro */}
      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Nuevo miembro del equipo">
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={submitCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fn">Nombre *</Label>
              <Input id="fn" required value={create.firstName} onChange={(e) => setCreate({ ...create, firstName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ln">Apellido *</Label>
              <Input id="ln" required value={create.lastName} onChange={(e) => setCreate({ ...create, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="em">Correo *</Label>
            <Input id="em" type="email" required value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="pw">Contraseña *</Label>
            <Input id="pw" type="text" required minLength={8} value={create.password} onChange={(e) => setCreate({ ...create, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rl">Rol *</Label>
              <Select id="rl" value={create.roleKey} onChange={(e) => setCreate({ ...create, roleKey: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ct">Cargo</Label>
              <Input id="ct" value={create.jobTitle} onChange={(e) => setCreate({ ...create, jobTitle: e.target.value })} placeholder="Ej: Desarrollador senior" />
            </div>
          </div>
          <p className="text-xs text-muted">La cuenta queda lista para iniciar sesión (sin verificación por correo).</p>
          <Button type="submit" loading={saving}>Crear miembro</Button>
        </form>
      </Modal>

      {/* Editar miembro */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar miembro">
        {error && <Alert kind="error">{error}</Alert>}
        {edit && (
          <form onSubmit={submitEdit} className="space-y-3">
            <div>
              <Label htmlFor="en">Nombre completo *</Label>
              <Input id="en" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ee">Correo *</Label>
              <Input id="ee" type="email" required value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="er">Rol *</Label>
                <Select id="er" value={edit.roleKey} onChange={(e) => setEdit({ ...edit, roleKey: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key}>{r.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ec">Cargo</Label>
                <Input id="ec" value={edit.jobTitle} onChange={(e) => setEdit({ ...edit, jobTitle: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="ep">Nueva contraseña</Label>
              <Input id="ep" type="text" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="Dejar vacío para no cambiar" />
            </div>
            {/* Motor de planificación: capacidad y dedicación por proyecto */}
            {(() => {
              const total = edit.assignments.reduce((t, a) => t + a.dedicationPct, 0);
              const projectById = new Map(projects.map((p) => [p.id, p]));
              const assignedIds = new Set(edit.assignments.map((a) => a.projectId));
              const availableProjects = projects
                .filter((p) => !assignedIds.has(p.id))
                .filter((p) => {
                  const q = assignQuery.trim().toLowerCase();
                  if (!q) return true;
                  return p.name.toLowerCase().includes(q) || (p.client?.name ?? "").toLowerCase().includes(q);
                });
              const updateAsg = (i: number, patch: Partial<Asg>) =>
                setEdit({ ...edit, assignments: edit.assignments.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              const addProject = (id: string) => {
                setEdit({ ...edit, assignments: [...edit.assignments, { projectId: id, dedicationPct: 50, priority: 1 }] });
                setAssignPickerOpen(false);
                setAssignQuery("");
              };
              const removeAsg = (i: number) =>
                setEdit({ ...edit, assignments: edit.assignments.filter((_, j) => j !== i) });
              return (
                <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Planificación</div>
                      <div className="text-xs text-muted">Proyectos a los que le dedicas tu tiempo.</div>
                    </div>
                    <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${total > 100 ? "bg-danger/15 text-danger" : total === 100 ? "bg-success/15 text-success" : "bg-surface-2 text-muted"}`}>
                      {total}% dedicado
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edh">Horas de trabajo diarias</Label>
                    <Input id="edh" type="number" min="1" max="24" step="0.5" value={edit.dailyHours} onChange={(e) => setEdit({ ...edit, dailyHours: e.target.value })} />
                  </div>

                  {/* Barra visual de la dedicación total */}
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full transition-all ${total > 100 ? "bg-danger" : "bg-brand"}`}
                      style={{ width: `${Math.min(100, total)}%` }}
                    />
                  </div>

                  {/* Tarjetas por proyecto asignado */}
                  <div className="space-y-2">
                    {edit.assignments.length === 0 && (
                      <p className="rounded-lg border border-dashed border-border bg-surface/40 px-3 py-4 text-center text-xs text-muted">
                        Aún no le has asignado ningún proyecto.
                      </p>
                    )}
                    {edit.assignments.map((a, i) => {
                      const p = projectById.get(a.projectId);
                      const name = p?.name ?? a.project?.name ?? "Proyecto";
                      const clientName = p?.client?.name ?? null;
                      return (
                        <div key={a.projectId} className="rounded-xl border border-border bg-surface p-3">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{name}</div>
                              {clientName && (
                                <div className="truncate text-xs text-muted">{clientName}</div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAsg(i)}
                              title="Quitar del proyecto"
                              className="rounded-lg p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {/* Slider de % dedicación */}
                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex-1">
                              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted">
                                <span>Dedicación</span>
                                <span className="font-mono text-xs text-foreground">{a.dedicationPct}%</span>
                              </div>
                              <input
                                type="range"
                                min={5}
                                max={100}
                                step={5}
                                value={a.dedicationPct}
                                onChange={(e) => updateAsg(i, { dedicationPct: Number(e.target.value) })}
                                className="w-full accent-[color:var(--brand)]"
                              />
                            </div>
                            {/* Prioridad como pills */}
                            <div>
                              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Prioridad</div>
                              <div className="flex gap-1">
                                {[1, 2, 3].map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => updateAsg(i, { priority: p })}
                                    className={`h-7 w-7 rounded-lg border text-xs font-semibold transition-colors ${
                                      a.priority === p
                                        ? "border-brand bg-brand-soft text-brand"
                                        : "border-border bg-background text-muted hover:text-foreground"
                                    }`}
                                    title={p === 1 ? "Alta" : p === 2 ? "Media" : "Baja"}
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Agregar proyecto — con buscador */}
                  {assignPickerOpen ? (
                    <div className="space-y-2 rounded-xl border border-border-strong bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          autoFocus
                          value={assignQuery}
                          onChange={(e) => setAssignQuery(e.target.value)}
                          placeholder="Buscar proyecto o cliente…"
                        />
                        <button
                          type="button"
                          onClick={() => { setAssignPickerOpen(false); setAssignQuery(""); }}
                          className="rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground"
                        >
                          Cancelar
                        </button>
                      </div>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {availableProjects.length === 0 && (
                          <p className="px-2 py-3 text-center text-xs text-muted">
                            {projects.length === assignedIds.size
                              ? "Ya está en todos los proyectos disponibles."
                              : "Ningún proyecto coincide."}
                          </p>
                        )}
                        {availableProjects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProject(p.id)}
                            className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-brand/40 hover:bg-surface"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand">
                              {p.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm">{p.name}</div>
                              {p.client?.name && (
                                <div className="truncate text-[11px] text-muted">{p.client.name}</div>
                              )}
                            </div>
                            <span className="text-xs text-brand">Agregar +</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAssignPickerOpen(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand-soft"
                    >
                      + Asignar a un proyecto
                    </button>
                  )}
                </div>
              );
            })()}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />
              Cuenta activa (puede iniciar sesión)
            </label>
            <Button type="submit" loading={saving}>Guardar cambios</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
