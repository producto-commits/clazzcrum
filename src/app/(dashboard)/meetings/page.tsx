"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type UserOpt = { id: string; name: string; email: string };
type Meeting = {
  id: string;
  title: string;
  date: string;
  hours: number;
  note: string | null;
  attendees: { user: { id: string; name: string } }[];
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: todayInput(), hours: "1", note: "", attendeeIds: [] as string[] });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setMeetings(await apiGet<Meeting[]>("/api/meetings"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiGet<UserOpt[]>("/api/users").then(setUsers).catch(() => setUsers([]));
  }, []);

  function toggle(id: string) {
    setForm((f) => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(id) ? f.attendeeIds.filter((x) => x !== id) : [...f.attendeeIds, id],
    }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.attendeeIds.length === 0) return setError("Selecciona al menos un asistente.");
    setSaving(true);
    try {
      await apiSend("/api/meetings", "POST", {
        title: form.title,
        date: form.date,
        hours: Number(form.hours),
        note: form.note || null,
        attendeeIds: form.attendeeIds,
      });
      setForm({ title: "", date: todayInput(), hours: "1", note: "", attendeeIds: [] });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Cancelar esta reunión? Se liberará la capacidad y se recalcularán los cronogramas.")) return;
    await apiSend(`/api/meetings/${id}`, "DELETE");
    await load();
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reuniones</h1>
        <Button onClick={() => setOpen(true)} className="w-auto px-4">
          + Nueva reunión
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted">
        Cada reunión resta capacidad del día a sus asistentes y recalcula automáticamente los cronogramas de sus proyectos.
      </p>

      {loading ? (
        <SkeletonRows />
      ) : meetings.length === 0 ? (
        <EmptyState
          title="No hay reuniones registradas"
          description="Programa una reunión para reflejar el tiempo que consume en la capacidad del equipo."
          action={
            <Button onClick={() => setOpen(true)} className="w-auto px-4">
              + Nueva reunión
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="min-w-0">
                <div className="font-medium">{m.title}</div>
                <div className="text-xs text-muted">
                  {fmt(m.date)} · {m.hours} h
                  {m.note && ` · ${m.note}`}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="flex -space-x-1">
                  {m.attendees.slice(0, 5).map((a) => (
                    <span
                      key={a.user.id}
                      title={a.user.name}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand ring-2 ring-surface"
                    >
                      {a.user.name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                    </span>
                  ))}
                  {m.attendees.length > 5 && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-[10px] text-muted ring-2 ring-surface">
                      +{m.attendees.length - 5}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => remove(m.id)}
                  title="Cancelar reunión"
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva reunión" wide>
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={create} className="space-y-3">
          <div>
            <Label htmlFor="mt">Título *</Label>
            <Input id="mt" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Daily · Reunión con cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="md">Fecha *</Label>
              <Input id="md" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mh">Duración (horas) *</Label>
              <Input id="mh" type="number" min="0.25" step="0.25" required value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="mn">Nota</Label>
            <Textarea id="mn" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Opcional" />
          </div>
          <div>
            <Label>Asistentes *</Label>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => {
                const on = form.attendeeIds.includes(u.id);
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      on ? "border-brand bg-brand/10 text-brand" : "border-border text-muted"
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Button type="submit" loading={saving}>
            Programar reunión
          </Button>
        </form>
      </Modal>
    </div>
  );
}
