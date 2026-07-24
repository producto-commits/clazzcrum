"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea, Select } from "@/components/ui/Inputs";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TicketCard } from "@/components/servicedesk/TicketCard";
import type { TicketRow } from "@/lib/ticketTypes";

// Estados que cuentan como "cerrado" para el usuario final.
const CLOSED = new Set(["RESOLVED", "CLOSED"]);

export function PortalSupport() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", priority: "MEDIUM" });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const openTickets = tickets.filter((t) => !CLOSED.has(t.status));
  const closedTickets = tickets.filter((t) => CLOSED.has(t.status));
  const shown = tab === "open" ? openTickets : closedTickets;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // 1) Crear el caso
      const t = await apiSend<{ id: string }>("/api/tickets", "POST", {
        subject: form.subject,
        description: form.description,
        priority: form.priority,
      });
      // 2) Subir el adjunto (opcional)
      if (file) {
        const fd = new FormData();
        fd.append("entityType", "ticket");
        fd.append("entityId", t.id);
        fd.append("file", file);
        const up = await fetch("/api/attachments", { method: "POST", body: fd });
        if (!up.ok) {
          const d = await up.json().catch(() => ({}));
          throw new Error(d.error ?? "El caso se creó, pero el adjunto no se pudo subir");
        }
      }
      setForm({ subject: "", description: "", priority: "MEDIUM" });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
      setTab("open");
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
        <h1 className="text-2xl font-semibold tracking-tight">Mis tickets</h1>
        <Button onClick={() => setOpen(true)} className="w-auto px-4">
          + Enviar ticket
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted">Abre un caso y sigue su estado. El equipo de Clazz te responderá.</p>

      {/* Pestañas Abiertos / Cerrados */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["open", `Abiertos (${openTickets.length})`],
            ["closed", `Cerrados (${closedTickets.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
              tab === key ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonCards />
      ) : shown.length === 0 ? (
        <EmptyState
          title={tab === "open" ? "No tienes tickets abiertos" : "No tienes tickets cerrados"}
          description={
            tab === "open"
              ? "Cuando necesites ayuda, envía un ticket con el botón de arriba."
              : "Aquí verás los casos resueltos o cerrados."
          }
          action={
            tab === "open" ? (
              <Button onClick={() => setOpen(true)} className="w-auto px-4">
                + Enviar ticket
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map((t) => (
            <TicketCard key={t.id} t={t} href={`/portal/soporte/${t.id}`} />
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Enviar ticket" wide>
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
            <Label htmlFor="desc">Proporciona una descripción de la incidencia *</Label>
            <Textarea
              id="desc"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Qué pasó, desde cuándo, qué esperabas que ocurriera…"
              className="min-h-[140px]"
            />
          </div>
          <div>
            <Label htmlFor="tfile">Adjuntar archivo (opcional)</Label>
            <input
              id="tfile"
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:brightness-110"
            />
            <p className="mt-1 text-xs text-muted">Imagen, PDF, documento u hoja de cálculo · máx. 15 MB.</p>
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
            Enviar ticket
          </Button>
        </form>
      </Modal>
    </div>
  );
}
