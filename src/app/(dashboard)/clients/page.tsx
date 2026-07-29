"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Client = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  parent: { id: string; name: string } | null;
  _count: { projects: number; tickets: number; children: number };
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contactName: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setClients(await apiGet<Client[]>("/api/clients"));
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
      await apiSend("/api/clients", "POST", form);
      setOpen(false);
      setForm({ name: "", contactName: "", email: "", phone: "", notes: "" });
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
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <Button onClick={() => setOpen(true)} className="w-auto px-4">
          + Nuevo cliente
        </Button>
      </div>

      {loading ? (
        <SkeletonCards />
      ) : clients.length === 0 ? (
        <EmptyState
          title="Aún no hay clientes"
          description="Registra un cliente para asociarle proyectos y casos de soporte."
          action={
            <Button onClick={() => setOpen(true)} className="w-auto px-4">
              + Nuevo cliente
            </Button>
          }
        />
      ) : (
        (() => {
          const roots = clients.filter((c) => !c.parent);
          const subs = clients.filter((c) => c.parent);
          return (
            <div className="space-y-8">
              {/* Clientes raíz */}
              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Clientes ({roots.length})
                  </h2>
                  <p className="text-xs text-muted">Empresas independientes</p>
                </div>
                {roots.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-surface/40 px-3 py-6 text-center text-sm text-muted">
                    No hay clientes raíz. Crea uno con el botón <b>+ Nuevo cliente</b>.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {roots.map((c) => (
                      <ClientCard key={c.id} c={c} />
                    ))}
                  </div>
                )}
              </section>

              {/* Subclientes */}
              {subs.length > 0 && (
                <section>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                      Subclientes ({subs.length})
                    </h2>
                    <p className="text-xs text-muted">Sedes o unidades de otro cliente</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {subs.map((c) => (
                      <ClientCard key={c.id} c={c} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          );
        })()
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo cliente">
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={create} className="space-y-3">
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
            <Label htmlFor="contact">Contacto</Label>
            <Input
              id="contact"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <Button type="submit" loading={saving}>
            Crear cliente
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function ClientCard({ c }: { c: Client }) {
  return (
    <Link
      href={`/clients/${c.id}`}
      className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{c.name}</span>
        <span className="text-muted" aria-hidden>›</span>
      </div>
      {c.parent && (
        <div className="mt-0.5 text-[11px] text-brand">↑ {c.parent.name}</div>
      )}
      {c.contactName && <div className="text-sm text-muted">{c.contactName}</div>}
      {c.email && <div className="text-sm text-muted">{c.email}</div>}
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted">
        <span className="rounded-full bg-background px-2 py-0.5">
          {c._count.projects} proyectos
        </span>
        <span className="rounded-full bg-background px-2 py-0.5">
          {c._count.tickets} casos
        </span>
        {c._count.children > 0 && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">
            {c._count.children} subcliente{c._count.children === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </Link>
  );
}
