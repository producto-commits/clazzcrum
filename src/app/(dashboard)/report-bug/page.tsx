"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Select, Textarea } from "@/components/ui/Inputs";

const MODULES = [
  "Panel",
  "Proyectos",
  "Estructura (hitos, fases, actividades)",
  "Tablero Kanban",
  "Sprints / Planificación",
  "Daily",
  "Reuniones",
  "Mesa de servicio (tickets)",
  "Documento de diseño",
  "Clientes",
  "Equipo",
  "Auditoría",
  "Portal del cliente",
  "Login / Sesión",
  "Notificaciones",
  "Manual / Documentación",
  "Otro",
];

// Página para que el equipo (dev, líder, admin) reporte un error de la
// plataforma Clazzcrum. Crea un ticket interno auto-asignado a Diego Forero.
export default function ReportBugPage() {
  const [module_, setModule] = useState("Panel");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; number: number | null; attachmentError: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setDescription("");
    setFile(null);
    setSuccess(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.append("module", module_);
      form.append("description", description);
      if (file) form.append("file", file);
      const res = await fetch("/api/bug-reports", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "No se pudo enviar el reporte");
      setSuccess({
        id: data.id,
        number: data.number ?? null,
        attachmentError: data.attachmentError ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-brand/40 bg-brand-soft/40 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-2xl text-brand-fg">
            ✓
          </div>
          <h1 className="text-xl font-semibold">¡Reporte enviado!</h1>
          <p className="mt-2 text-sm text-muted">
            El bug quedó registrado como ticket interno
            {success.number != null && (
              <> <span className="font-mono">#{String(success.number).padStart(3, "0")}</span></>
            )}
            {" "}y fue asignado al equipo de plataforma.
          </p>
          {success.attachmentError && (
            <p className="mt-2 rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning">
              La descripción se guardó, pero la captura no se pudo adjuntar: {success.attachmentError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={reset} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm hover:border-brand/40">
              Reportar otro
            </button>
            <Link href={`/service-desk/${success.id}`} className="rounded-lg border border-brand/40 bg-brand-soft px-4 py-2 text-sm font-medium text-brand hover:brightness-110">
              Ver el caso →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reportar un error</h1>
        <p className="text-sm text-muted">
          ¿Encontraste algo raro en Clazzcrum? Cuéntanos qué pasó y el equipo de plataforma lo revisa.
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <Label htmlFor="mod">Módulo donde ocurre *</Label>
          <Select id="mod" value={module_} onChange={(e) => setModule(e.target.value)}>
            {MODULES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="desc">Descripción del error *</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Qué esperabas que pasara, qué pasó realmente, qué pasos hiciste antes…"
            rows={6}
            required
          />
          <p className="mt-1 text-xs text-muted">
            Cuanto más específico, más rápido lo arreglamos. Ej: “Al mover una actividad a Completado no aparece el modal de evidencia”.
          </p>
        </div>

        <div>
          <Label htmlFor="cap">Captura de pantalla (opcional)</Label>
          <Input
            id="cap"
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-muted">
            PNG, JPG, WEBP, GIF o PDF · máx. 15 MB. Ayuda muchísimo tener una imagen del error.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted">
          <span aria-hidden>ℹ</span>
          Se crea un caso interno con prioridad <b>Alta</b>, asignado al equipo de plataforma. Puedes seguirlo desde <Link href="/service-desk" className="text-brand hover:underline">Mesa de servicio</Link>.
        </div>

        <Button type="submit" loading={saving}>Enviar reporte</Button>
      </form>
    </div>
  );
}
