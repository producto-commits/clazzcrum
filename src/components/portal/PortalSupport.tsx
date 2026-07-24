"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea, Select, PRIORITY_LABELS, PRIORITY_CLASSES } from "@/components/ui/Inputs";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TICKET_STATUS_LABELS, TICKET_STATUS_CLASSES, type TicketRow } from "@/lib/ticketTypes";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

export function PortalSupport() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", priority: "MEDIUM" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setTickets(await apiGet<TicketRow[]>("/api/tickets"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend("/api/tickets", "POST", {
        subject: form.subject,
        description: form.description,
        priority: form.priority,
      });
      setForm({ subject: "", description: "", priority: "MEDIUM" });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Soporte</h1>
        <Button onClick={() => setOpen(true)} className="w-auto px-4">
          + Nuevo caso
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted">Abre un caso y sigue su estado. El equipo de Clazz te responderá.</p>

      {loading ? (
        <SkeletonRows />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No tienes casos abiertos"
          description="Cuando necesites ayuda, abre un caso con el botón “Nuevo caso”."
          action={
            <Button onClick={() => setOpen(true)} className="w-auto px-4">
              + Nuevo caso
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.subject}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TICKET_STATUS_CLASSES[t.status]}`}>
                  {TICKET_STATUS_LABELS[t.status]}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${PRIORITY_CLASSES[t.priority]}`}>
                  {PRIORITY_LABELS[t.priority]}
                </span>
                <span className="ml-auto text-xs text-muted">{fmt(t.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo caso de soporte">
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={create} className="space-y-3">
          <div>
            <Label htmlFor="subject">Asunto *</Label>
            <Input
              id="subject"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Ej: No puedo ver el reporte de métricas"
            />
          </div>
          <div>
            <Label htmlFor="desc">Descripción *</Label>
            <Textarea
              id="desc"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Cuéntanos qué pasa, con el mayor detalle posible…"
            />
          </div>
          <div>
            <Label htmlFor="prio">Prioridad</Label>
            <Select id="prio" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </Select>
          </div>
          <Button type="submit" loading={saving}>
            Crear caso
          </Button>
        </form>
      </Modal>
    </div>
  );
}
