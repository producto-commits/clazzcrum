"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";

type Project = { id: string; name: string; status: string; description: string | null };
type Member = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  projectAccess: { projectId: string }[];
};
type ChildClient = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  _count: { projects: number; tickets: number; children: number };
};
type Client = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  parent: { id: string; name: string } | null;
  children: ChildClient[];
  projects: Project[];
  members: Member[];
  _count: { tickets: number };
};

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planeación",
  ACTIVE: "Activo",
  ON_HOLD: "En pausa",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const emptyMember = { firstName: "", lastName: "", email: "", password: "", jobTitle: "", projectIds: [] as string[] };

export function ClientDetail({ clientId }: { clientId: string }) {
  const { can } = useMe();
  const canManageUsers = can("create", "user");
  const canDeleteClient = can("delete", "client");
  const [c, setC] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const [projOpen, setProjOpen] = useState(false);
  const [projForm, setProjForm] = useState({ name: "", description: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", contactName: "", email: "", phone: "", notes: "" });
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ ...emptyMember });
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [memberEditForm, setMemberEditForm] = useState({
    name: "",
    email: "",
    jobTitle: "",
    password: "",
    isActive: true,
    projectIds: [] as string[],
  });
  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState({ name: "", contactName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setC(await apiGet<Client>(`/api/clients/${clientId}`));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend("/api/projects", "POST", {
        clientId,
        name: projForm.name,
        description: projForm.description || null,
      });
      setProjOpen(false);
      setProjForm({ name: "", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function addSubclient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend("/api/clients", "POST", {
        name: subForm.name,
        contactName: subForm.contactName || null,
        email: subForm.email || null,
        phone: subForm.phone || null,
        parentId: clientId,
      });
      setSubOpen(false);
      setSubForm({ name: "", contactName: "", email: "", phone: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function openEdit() {
    if (!c) return;
    setError(null);
    setEditForm({
      name: c.name,
      contactName: c.contactName ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend(`/api/clients/${clientId}`, "PATCH", editForm);
      setEditOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend(`/api/clients/${clientId}/members`, "POST", memberForm);
      setMemberOpen(false);
      setMemberForm({ ...emptyMember });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function startEditMember(m: Member) {
    setError(null);
    setEditMember(m);
    setMemberEditForm({
      name: m.name,
      email: m.email,
      jobTitle: m.jobTitle ?? "",
      password: "",
      isActive: m.isActive,
      projectIds: m.projectAccess.map((p) => p.projectId),
    });
  }

  async function saveMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editMember) return;
    setError(null);
    setSaving(true);
    try {
      await apiSend(`/api/admin/users/${editMember.id}`, "PATCH", {
        name: memberEditForm.name,
        email: memberEditForm.email,
        jobTitle: memberEditForm.jobTitle,
        isActive: memberEditForm.isActive,
        projectIds: memberEditForm.projectIds,
        ...(memberEditForm.password ? { password: memberEditForm.password } : {}),
      });
      setEditMember(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function removeClient() {
    if (!c) return;
    const detail =
      [c.projects.length && `${c.projects.length} proyecto(s)`, c._count.tickets && `${c._count.tickets} ticket(s)`]
        .filter(Boolean)
        .join(", ") || "sin proyectos ni casos vinculados";
    if (!confirm(`¿Eliminar el cliente “${c.name}”? Se borrarán también ${detail}. Sus contactos quedarán sin cliente.`)) return;
    try {
      await apiSend(`/api/clients/${c.id}`, "DELETE");
      window.location.href = "/clients";
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  async function removeMember(m: Member) {
    if (!confirm(`¿Eliminar a ${m.name}? Perderá el acceso al portal.`)) return;
    setError(null);
    try {
      await apiSend(`/api/admin/users/${m.id}`, "DELETE");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  if (loading || !c) return <p className="text-sm text-muted">Cargando cliente…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <Link href="/clients" className="text-xs text-muted hover:underline">
            ← Clientes
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            {c.parent && (
              <Link
                href={`/clients/${c.parent.id}`}
                className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand transition-colors hover:brightness-110"
                title={`Subcliente de ${c.parent.name}`}
              >
                ↑ {c.parent.name}
              </Link>
            )}
          </div>
          <p className="text-sm text-muted">
            {[c.contactName, c.email, c.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={openEdit} className="w-auto px-3">
            Editar cliente
          </Button>
          {canDeleteClient && (
            <button
              type="button"
              onClick={removeClient}
              title="Eliminar cliente"
              aria-label="Eliminar cliente"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {c.notes && (
        <p className="rounded-xl border border-border bg-surface p-3 text-sm text-muted">{c.notes}</p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Proyectos ({c.projects.length})
          </h2>
          <Button onClick={() => setProjOpen(true)} className="w-auto px-4">
            + Nuevo proyecto
          </Button>
        </div>

        {c.projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-8 text-center text-sm text-muted">
            Este cliente aún no tiene proyectos. Agrega el primero — puedes crear uno por cada área.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted">
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Subclientes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Subclientes ({c.children.length})
          </h2>
          {canManageUsers && (
            <Button onClick={() => setSubOpen(true)} className="w-auto px-4">
              + Nuevo subcliente
            </Button>
          )}
        </div>
        {c.children.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/40 px-3 py-4 text-center text-sm text-muted">
            Este cliente no tiene subclientes. Añade uno si es una empresa madre con sedes o unidades.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.children.map((sub) => (
              <Link
                key={sub.id}
                href={`/clients/${sub.id}`}
                className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{sub.name}</span>
                  <span className="text-muted" aria-hidden>›</span>
                </div>
                {(sub.contactName || sub.email) && (
                  <div className="mt-1 truncate text-xs text-muted">
                    {[sub.contactName, sub.email].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted">
                  <span className="rounded-full bg-background px-2 py-0.5">
                    {sub._count.projects} proyecto{sub._count.projects === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5">
                    {sub._count.tickets} ticket{sub._count.tickets === 1 ? "" : "s"}
                  </span>
                  {sub._count.children > 0 && (
                    <span className="rounded-full bg-background px-2 py-0.5">
                      {sub._count.children} subcliente{sub._count.children === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Equipo del cliente */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Equipo del cliente ({c.members.length})
          </h2>
          {canManageUsers && (
            <Button onClick={() => setMemberOpen(true)} className="w-auto px-4">
              + Nuevo usuario
            </Button>
          )}
        </div>
        <p className="mb-3 text-xs text-muted">
          Personas del cliente que acceden al portal para ver sus proyectos y crear casos de soporte.
        </p>

        {c.members.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-8 text-center text-sm text-muted">
            Este cliente aún no tiene usuarios de portal.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            {c.members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 last:border-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {m.name.split(" ").slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("")}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    {!m.isActive && (
                      <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] text-danger">Inactivo</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {m.email}
                    {m.jobTitle && ` · ${m.jobTitle}`}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="hidden rounded-full bg-background px-2.5 py-0.5 text-[11px] text-muted sm:inline">
                    {m.projectAccess.length === 0
                      ? "Todos los proyectos"
                      : `${m.projectAccess.length} proyecto${m.projectAccess.length > 1 ? "s" : ""}`}
                  </span>
                  {canManageUsers && (
                    <>
                      <Button variant="ghost" onClick={() => startEditMember(m)} className="w-auto px-3 py-1.5 text-xs">
                        Editar
                      </Button>
                      <button
                        onClick={() => removeMember(m)}
                        title="Eliminar contacto"
                        aria-label={`Eliminar ${m.name}`}
                        className="rounded-lg p-1.5 text-xs text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Nuevo usuario del cliente */}
      <Modal open={memberOpen} onClose={() => setMemberOpen(false)} title={`Nuevo usuario · ${c.name}`} wide>
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={addMember} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mfn">Nombre *</Label>
              <Input id="mfn" required value={memberForm.firstName} onChange={(e) => setMemberForm({ ...memberForm, firstName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mln">Apellido *</Label>
              <Input id="mln" required value={memberForm.lastName} onChange={(e) => setMemberForm({ ...memberForm, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="mem">Correo *</Label>
            <Input id="mem" type="email" required value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="mpw">Contraseña *</Label>
            <Input id="mpw" type="text" required minLength={8} value={memberForm.password} onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <Label htmlFor="mct">Cargo</Label>
            <Input id="mct" value={memberForm.jobTitle} onChange={(e) => setMemberForm({ ...memberForm, jobTitle: e.target.value })} placeholder="Ej: Gerente de proyecto" />
          </div>

          {/* Acceso a proyectos */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Proyectos que puede ver</Label>
              <span className="text-xs text-muted">
                {memberForm.projectIds.length === 0 ? "Todos" : `${memberForm.projectIds.length} seleccionados`}
              </span>
            </div>
            {c.projects.length === 0 ? (
              <p className="text-xs text-muted">Este cliente aún no tiene proyectos.</p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-2">
                {c.projects.map((p) => {
                  const on = memberForm.projectIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${on ? "bg-brand-soft text-brand" : "hover:bg-background"}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            projectIds: e.target.checked
                              ? [...memberForm.projectIds, p.id]
                              : memberForm.projectIds.filter((x) => x !== p.id),
                          })
                        }
                      />
                      <span className="font-medium">{p.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-1.5 text-xs text-muted">
              Si no marcas ninguno, verá <strong>todos</strong> los proyectos del cliente.
            </p>
          </div>

          <p className="text-xs text-muted">Accede al portal como cliente y solo ve la información de {c.name}.</p>
          <Button type="submit" loading={saving}>Crear usuario</Button>
        </form>
      </Modal>

      {/* Editar usuario del cliente */}
      <Modal open={editMember !== null} onClose={() => setEditMember(null)} title="Editar usuario del cliente" wide>
        {error && <Alert kind="error">{error}</Alert>}
        {editMember && (
          <form onSubmit={saveMember} className="space-y-5">
            {/* Identidad */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {editMember.name.split(" ").slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("")}
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">{editMember.name}</div>
                <div className="truncate text-xs text-muted">Usuario de portal · {c.name}</div>
              </div>
            </div>

            {/* Datos */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="men">Nombre completo *</Label>
                  <Input id="men" required value={memberEditForm.name} onChange={(e) => setMemberEditForm({ ...memberEditForm, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="mec">Cargo</Label>
                  <Input id="mec" value={memberEditForm.jobTitle} onChange={(e) => setMemberEditForm({ ...memberEditForm, jobTitle: e.target.value })} placeholder="Ej: Gerente de proyecto" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="mee">Correo *</Label>
                  <Input id="mee" type="email" required value={memberEditForm.email} onChange={(e) => setMemberEditForm({ ...memberEditForm, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="mep">Nueva contraseña</Label>
                  <Input id="mep" type="text" value={memberEditForm.password} onChange={(e) => setMemberEditForm({ ...memberEditForm, password: e.target.value })} placeholder="Dejar vacío para no cambiar" />
                </div>
              </div>
            </div>

            {/* Acceso a proyectos */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label>Proyectos que puede ver</Label>
                <span className="text-xs text-muted">
                  {memberEditForm.projectIds.length === 0 ? "Todos" : `${memberEditForm.projectIds.length} seleccionados`}
                </span>
              </div>
              {c.projects.length === 0 ? (
                <p className="text-xs text-muted">Este cliente aún no tiene proyectos.</p>
              ) : (
                <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-2">
                  {c.projects.map((p) => {
                    const on = memberEditForm.projectIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${on ? "bg-brand-soft text-brand" : "hover:bg-background"}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setMemberEditForm({
                              ...memberEditForm,
                              projectIds: e.target.checked
                                ? [...memberEditForm.projectIds, p.id]
                                : memberEditForm.projectIds.filter((x) => x !== p.id),
                            })
                          }
                        />
                        <span className="font-medium">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-1.5 text-xs text-muted">
                Si no marcas ninguno, verá <strong>todos</strong> los proyectos del cliente.
              </p>
            </div>

            {/* Estado */}
            <button
              type="button"
              onClick={() => setMemberEditForm({ ...memberEditForm, isActive: !memberEditForm.isActive })}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm"
            >
              <span className="text-left">
                <span className="block font-medium">Cuenta activa</span>
                <span className="block text-xs text-muted">Puede iniciar sesión en el portal</span>
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${memberEditForm.isActive ? "bg-brand" : "bg-border-strong"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${memberEditForm.isActive ? "translate-x-[22px]" : "translate-x-0.5"}`}
                />
              </span>
            </button>

            <Button type="submit" loading={saving}>Guardar cambios</Button>
          </form>
        )}
      </Modal>

      {/* Nuevo proyecto para este cliente */}
      <Modal open={projOpen} onClose={() => setProjOpen(false)} title={`Nuevo proyecto · ${c.name}`}>
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={addProject} className="space-y-3">
          <div>
            <Label htmlFor="pn">Nombre del proyecto *</Label>
            <Input id="pn" required value={projForm.name} onChange={(e) => setProjForm({ ...projForm, name: e.target.value })} placeholder="Ej: Sitio web, App móvil, Marketing…" />
          </div>
          <div>
            <Label htmlFor="pd">Descripción</Label>
            <Textarea id="pd" value={projForm.description} onChange={(e) => setProjForm({ ...projForm, description: e.target.value })} />
          </div>
          <Button type="submit" loading={saving}>Crear proyecto</Button>
        </form>
      </Modal>

      {/* Editar cliente */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar cliente">
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={saveEdit} className="space-y-3">
          <div>
            <Label htmlFor="cn">Nombre *</Label>
            <Input id="cn" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cc">Contacto</Label>
            <Input id="cc" value={editForm.contactName} onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ce">Correo</Label>
              <Input id="ce" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cp">Teléfono</Label>
              <Input id="cp" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="cnotes">Notas</Label>
            <Textarea id="cnotes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <Button type="submit" loading={saving}>Guardar cambios</Button>
        </form>
      </Modal>

      {/* Nuevo subcliente */}
      <Modal open={subOpen} onClose={() => setSubOpen(false)} title={`Nuevo subcliente · ${c.name}`}>
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={addSubclient} className="space-y-3">
          <div>
            <Label htmlFor="sn">Nombre *</Label>
            <Input id="sn" required value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} placeholder="Ej: Sede Bogotá" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="scn">Contacto</Label>
              <Input id="scn" value={subForm.contactName} onChange={(e) => setSubForm({ ...subForm, contactName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="se">Correo</Label>
              <Input id="se" type="email" value={subForm.email} onChange={(e) => setSubForm({ ...subForm, email: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="sp">Teléfono</Label>
            <Input id="sp" value={subForm.phone} onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })} />
          </div>
          <p className="text-xs text-muted">
            Pertenecerá a <b>{c.name}</b>. Podrás moverlo o hacerlo cliente raíz desde su ficha.
          </p>
          <Button type="submit" loading={saving}>Crear subcliente</Button>
        </form>
      </Modal>
    </div>
  );
}
