"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Select } from "@/components/ui/Inputs";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Doc = {
  id: string;
  title: string;
  status: "DRAFT" | "SENT" | "APPROVED";
  currentVersion: number;
  project: { id: string; name: string };
};
type ProjectOpt = { id: string; name: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Borrador", cls: "bg-slate-500/15 text-slate-400" },
  SENT: { label: "Enviado", cls: "bg-sky-500/15 text-sky-400" },
  APPROVED: { label: "Aprobado", cls: "bg-green-500/15 text-green-500" },
};

export default function DiscoveryPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ projectId: "", title: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setDocs(await apiGet<Doc[]>("/api/design-docs"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function openModal() {
    setError(null);
    const ps = await apiGet<ProjectOpt[]>("/api/projects").catch(() => []);
    setProjects(ps);
    setForm({ projectId: ps[0]?.id ?? "", title: "" });
    setOpen(true);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const doc = await apiSend<Doc>("/api/design-docs", "POST", form);
      setOpen(false);
      window.location.href = `/discovery/${doc.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Documentos de diseño</h1>
        <Button onClick={openModal} className="w-auto px-4">
          + Nuevo documento
        </Button>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : docs.length === 0 ? (
        <EmptyState
          title="Aún no hay documentos de diseño"
          description="Genera un documento guiado (tipo SRS) para alinear el alcance con el cliente."
          action={
            <Button onClick={openModal} className="w-auto px-4">
              + Nuevo documento
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Link
              key={d.id}
              href={`/discovery/${d.id}`}
              className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{d.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS[d.status].cls}`}>
                  {STATUS[d.status].label}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted">{d.project.name}</div>
              <div className="mt-2 text-xs text-muted">Versión {d.currentVersion}</div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo documento de diseño">
        {error && <Alert kind="error">{error}</Alert>}
        <form onSubmit={create} className="space-y-3">
          <div>
            <Label htmlFor="proj">Proyecto *</Label>
            <Select id="proj" required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="" disabled>
                Selecciona…
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Documento de diseño — …"
            />
          </div>
          <Button type="submit" loading={saving} disabled={!form.projectId}>
            Crear documento
          </Button>
        </form>
      </Modal>
    </div>
  );
}
