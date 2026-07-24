"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Select } from "@/components/ui/Inputs";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Row = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  roles: { role: { key: string; name: string } }[];
};

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
