"use client";

import { useRef, useState } from "react";
import { apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";

// Fecha de hoy en formato YYYY-MM-DD para el input date.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Al completar una historia se exige evidencia: descripción + un adjunto.
export function CompleteStoryModal({
  storyId,
  storyTitle,
  open,
  onClose,
  onDone,
}: {
  storyId: string | null;
  storyTitle?: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [evidence, setEvidence] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [spentHours, setSpentHours] = useState("");
  const [actualEnd, setActualEnd] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEvidence("");
    setFile(null);
    setSpentHours("");
    setActualEnd(today());
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!storyId) return;
    setError(null);
    if (!evidence.trim()) return setError("Describe la evidencia.");
    if (!file) return setError("Adjunta un archivo de evidencia.");
    if (spentHours === "" || Number(spentHours) < 0) return setError("Indica las horas reales dedicadas.");
    if (!actualEnd) return setError("Indica la fecha de finalización.");

    setSaving(true);
    try {
      // 1) Subir el adjunto de evidencia
      const form = new FormData();
      form.append("entityType", "story");
      form.append("entityId", storyId);
      form.append("file", file);
      const up = await fetch("/api/attachments", { method: "POST", body: form });
      if (!up.ok) {
        const d = await up.json().catch(() => ({}));
        throw new Error(d.error ?? "No se pudo subir el adjunto");
      }
      // 2) Marcar completada con la evidencia + horas reales + fecha de fin
      await apiSend(`/api/stories/${storyId}`, "PATCH", {
        status: "DONE",
        completionEvidence: evidence.trim(),
        spentHours: Number(spentHours),
        actualEnd,
      });
      reset();
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Completar historia">
      <p className="mb-4 text-sm text-muted">
        Para marcar {storyTitle ? <span className="font-medium text-foreground">“{storyTitle}”</span> : "esta historia"} como
        completada, registra la evidencia del trabajo realizado.
      </p>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="spent">Horas reales *</Label>
            <Input
              id="spent"
              type="number"
              min="0"
              step="0.5"
              required
              value={spentHours}
              onChange={(e) => setSpentHours(e.target.value)}
              placeholder="Ej: 8"
            />
          </div>
          <div>
            <Label htmlFor="actualEnd">Fecha de finalización *</Label>
            <Input
              id="actualEnd"
              type="date"
              required
              value={actualEnd}
              onChange={(e) => setActualEnd(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="evidence">Descripción de la evidencia *</Label>
          <Textarea
            id="evidence"
            required
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Qué se hizo, cómo se validó, enlaces relevantes…"
          />
        </div>
        <div>
          <Label htmlFor="file">Adjunto de evidencia *</Label>
          <input
            id="file"
            ref={fileRef}
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:brightness-105"
          />
          <p className="mt-1 text-xs text-muted">
            Imagen, PDF, documento u hoja de cálculo · máx. 15 MB.
          </p>
        </div>
        <Button type="submit" loading={saving}>
          Marcar como completada
        </Button>
      </form>
    </Modal>
  );
}
