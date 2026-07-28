"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Input, Button, Alert } from "@/components/ui/Field";

type UserOpt = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  roles: { role: { key: string; name: string } }[];
};
type Assignment = {
  userId: string;
  dedicationPct: number;
  priority: number;
  user: UserOpt;
};

// Modal para gestionar el equipo asignado al proyecto — quién trabaja aquí,
// con qué % de dedicación y prioridad. Alimenta al motor de planificación.
export function ProjectTeamModal({
  projectId,
  open,
  onClose,
  onSaved,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Assignment[]>(`/api/projects/${projectId}/assignments`);
      setAssignments(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    load();
    setError(null);
    setPickerOpen(false);
    setQuery("");
    apiGet<UserOpt[]>("/api/admin/users").then(setUsers).catch(() => setUsers([]));
  }, [open, load]);

  const staffUsers = useMemo(
    () =>
      users.filter((u) => {
        const roleKey = u.roles[0]?.role.key;
        return (
          u.isActive &&
          (roleKey === "developer" || roleKey === "tech_lead" || roleKey === "admin")
        );
      }),
    [users],
  );

  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.userId)), [assignments]);
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staffUsers
      .filter((u) => !assignedIds.has(u.id))
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.jobTitle ?? "").toLowerCase().includes(q)
        );
      });
  }, [staffUsers, assignedIds, query]);

  const total = assignments.reduce((n, a) => n + a.dedicationPct, 0);
  const totalOverloaded = total > 100;

  function addMember(u: UserOpt) {
    setAssignments((prev) => [
      ...prev,
      { userId: u.id, dedicationPct: 50, priority: 1, user: u },
    ]);
    setPickerOpen(false);
    setQuery("");
  }
  function removeMember(userId: string) {
    setAssignments((prev) => prev.filter((a) => a.userId !== userId));
  }
  function updateMember(userId: string, patch: Partial<Pick<Assignment, "dedicationPct" | "priority">>) {
    setAssignments((prev) => prev.map((a) => (a.userId === userId ? { ...a, ...patch } : a)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiSend(`/api/projects/${projectId}/assignments`, "POST", {
        assignments: assignments.map((a) => ({
          userId: a.userId,
          dedicationPct: a.dedicationPct,
          priority: a.priority,
        })),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Equipo del proyecto" wide>
      {error && <Alert kind="error">{error}</Alert>}
      <p className="mb-3 text-sm text-muted">
        Personas del equipo que trabajan en este proyecto, con su % de dedicación y su prioridad
        para el motor de planificación.
      </p>

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {assignments.length} persona{assignments.length === 1 ? "" : "s"} asignada{assignments.length === 1 ? "" : "s"}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                totalOverloaded
                  ? "bg-danger/15 text-danger"
                  : "bg-surface-2 text-muted"
              }`}
            >
              Dedicación total: {total}%
            </span>
          </div>

          {assignments.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-surface/40 px-3 py-6 text-center text-xs text-muted">
              Aún no hay nadie asignado a este proyecto.
            </p>
          )}

          <div className="space-y-2">
            {assignments.map((a) => {
              const roleName = a.user.roles[0]?.role.name ?? "";
              return (
                <div key={a.userId} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                      {a.user.name.split(" ").slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{a.user.name}</span>
                        {roleName && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                            {roleName}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {a.user.email}
                        {a.user.jobTitle && ` · ${a.user.jobTitle}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMember(a.userId)}
                      title="Quitar del proyecto"
                      className="rounded-lg p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
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
                        onChange={(e) => updateMember(a.userId, { dedicationPct: Number(e.target.value) })}
                        className="w-full accent-[color:var(--brand)]"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Prioridad</div>
                      <div className="flex gap-1">
                        {[1, 2, 3].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => updateMember(a.userId, { priority: p })}
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

          {pickerOpen ? (
            <div className="space-y-2 rounded-xl border border-border-strong bg-background p-3">
              <div className="flex items-center gap-2">
                <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, correo o cargo…" />
                <button
                  type="button"
                  onClick={() => { setPickerOpen(false); setQuery(""); }}
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {available.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-muted">
                    {assignedIds.size === staffUsers.length
                      ? "Ya están asignados todos los miembros del equipo."
                      : "Ningún miembro coincide."}
                  </p>
                )}
                {available.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addMember(u)}
                    className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-brand/40 hover:bg-surface"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                      {u.name.split(" ").slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{u.name}</div>
                      <div className="truncate text-[11px] text-muted">
                        {u.roles[0]?.role.name}
                        {u.jobTitle && ` · ${u.jobTitle}`}
                      </div>
                    </div>
                    <span className="text-xs text-brand">Asignar +</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand-soft"
            >
              + Asignar una persona al proyecto
            </button>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
            >
              Cerrar
            </button>
            <Button className="w-auto px-4" onClick={save} loading={saving}>
              Guardar equipo
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
