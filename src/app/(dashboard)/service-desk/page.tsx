"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea, Select, PRIORITY_LABELS, PRIORITY_CLASSES } from "@/components/ui/Inputs";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_CLASSES,
  slaState,
  SLA_LABELS,
  SLA_CLASSES,
  type TicketRow,
} from "@/lib/ticketTypes";

type Cat = { id: string; name: string };
type ClientOpt = { id: string; name: string };

export default function ServiceDeskPage() {
  const { can } = useMe();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "", priority: "", q: "" });
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<Cat[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [form, setForm] = useState({ subject: "", description: "", priority: "MEDIUM", categoryId: "", clientId: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCreate = can("create", "ticket");
  const isStaff = can("edit", "ticket") || can("create", "project");

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.status) qs.set("status", filters.status);
      if (filters.priority) qs.set("priority", filters.priority);
      if (filters.q) qs.set("q", filters.q);
      setTickets(await apiGet<TicketRow[]>(`/api/tickets?${qs.toString()}`));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function openModal() {
    setError(null);
    apiGet<Cat[]>("/api/ticket-categories").then(setCats).catch(() => {});
    apiGet<ClientOpt[]>("/api/clients")
      .then((cs) => {
        setClients(cs);
        setForm((f) => ({ ...f, clientId: cs[0]?.id ?? "" }));
      })
      .catch(() => setClients([]));
    setOpen(true);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiSend("/api/tickets", "POST", {
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        categoryId: form.categoryId || null,
        clientId: form.clientId || null,
      });
      setOpen(false);
      setForm({ subject: "", description: "", priority: "MEDIUM", categoryId: "", clientId: "" });
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
        <h1 className="text-2xl font-semibold tracking-tight">Mesa de servicio</h1>
        {canCreate && (
          <Button onClick={openModal} className="w-auto px-4">
            + Nuevo caso
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          placeholder="Buscar…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-auto">
          <option value="">Todos los estados</option>
          {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="w-auto">
          <option value="">Toda prioridad</option>
          <option value="LOW">Baja</option>
          <option value="MEDIUM">Media</option>
          <option value="HIGH">Alta</option>
          <option value="CRITICAL">Crítica</option>
        </Select>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No hay casos"
          description={
            canCreate
              ? "Crea un caso para dar seguimiento a una solicitud o incidencia."
              : "Cuando reportes o te asignen un caso, aparecerá aquí."
          }
          action={
            canCreate ? (
              <Button onClick={openModal} className="w-auto px-4">
                + Nuevo caso
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {tickets.map((tk) => {
            const resSla = slaState(tk.resolutionDueAt, tk.resolvedAt);
            return (
              <Link
                key={tk.id}
                href={`/service-desk/${tk.id}`}
                className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3 last:border-0 hover:bg-background"
              >
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TICKET_STATUS_CLASSES[tk.status]}`}>
                  {TICKET_STATUS_LABELS[tk.status]}
                </span>
                <span className="font-medium">{tk.subject}</span>
                {isStaff && <span className="text-xs text-muted">· {tk.client.name}</span>}
                <div className="ml-auto flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 ${PRIORITY_CLASSES[tk.priority]}`}>
                    {PRIORITY_LABELS[tk.priority]}
                  </span>
                  {resSla !== "none" && (
                    <span className={`rounded-full px-2 py-0.5 ${SLA_CLASSES[resSla]}`}>
                      SLA: {SLA_LABELS[resSla]}
                    </span>
                  )}
                  <span className="text-muted">{tk.assignee ? tk.assignee.name : "sin asignar"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo caso de soporte">
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={create} className="space-y-3">
          {clients.length > 0 && (
            <div>
              <Label htmlFor="tclient">Cliente</Label>
              <Select id="tclient" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="subject">Asunto *</Label>
            <Input id="subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="desc">Descripción *</Label>
            <Textarea id="desc" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prio">Prioridad</Label>
              <Select id="prio" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="cat">Categoría</Label>
              <Select id="cat" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">— sin categoría —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="submit" loading={saving}>
            Crear caso
          </Button>
        </form>
      </Modal>
    </div>
  );
}
