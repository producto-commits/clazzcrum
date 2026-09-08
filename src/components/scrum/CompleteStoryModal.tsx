"use client";

import { useState } from "react";
import { apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";
import { EvidencePicker, MAX_EVIDENCE, uploadEvidence, useEvidence } from "@/components/ui/EvidencePicker";

// Fecha de hoy en formato YYYY-MM-DD para el input date.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Al completar una historia se exige evidencia: descripción + al menos un
// adjunto (archivo o enlace), hasta 10 en total.
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
  const [spentHours, setSpentHours] = useState("");
  const [actualEnd, setActualEnd] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ev = useEvidence();

  function reset() {
    setEvidence("");
    setSpentHours("");
    setActualEnd(today());
    setError(null);
    ev.reset();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!storyId) return;
    setError(null);
    if (!evidence.trim()) return setError("Describe la evidencia.");
    let picked: { files: File[]; links: string[] };
    try {
      picked = ev.collect();
    } catch (err) {
      return setError(err instanceof Error ? err.message : "Evidencia inválida");
    }
    if (spentHours === "" || Number(spentHours) < 0) return setError("Indica las horas reales dedicadas.");

    setSaving(true);
    try {
      // 1) Subir archivos y registrar enlaces; si alguno falla, reportamos
      // cuántos y con el mensaje del primer error — el resto ya quedó en la
      // historia (Attachments).
      const up = await uploadEvidence("story", storyId, picked.files, picked.links);
      if (up.failed === up.total) throw new Error(up.firstError ?? "No se pudieron subir los adjuntos");
      if (up.failed > 0) {
        setError(`Se registraron ${up.total - up.failed}/${up.total} evidencias. Falló: ${up.firstError ?? ""}`);
      }

      // 2) Marcar completada con la evidencia + horas reales + fecha de fin
      await apiSend(`/api/stories/${storyId}`, "PATCH", {
        status: "DONE",
        completionEvidence: evidence.trim(),
        spentHours: Number(spentHours),
        actualEnd,
      });
      if (up.failed === 0) reset();
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const displayError = error ?? ev.error;

  return (
    <Modal open={open} onClose={onClose} title="Completar actividad">
      <p className="mb-4 text-sm text-muted">
        Para marcar {storyTitle ? <span className="font-medium text-foreground">“{storyTitle}”</span> : "esta actividad"} como
        completada, registra la evidencia del trabajo realizado.
      </p>
      {displayError && <Alert kind="error">{displayError}</Alert>}
      <form onSubmit={submit} onPaste={ev.handlePaste} className="space-y-4">
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
            <Label htmlFor="actualEnd">Fecha de finalización (automática)</Label>
            <Input id="actualEnd" type="date" value={actualEnd} disabled readOnly />
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
          <Label htmlFor="evidence-file">
            Adjuntos de evidencia (archivo o enlace) *{" "}
            <span className="text-xs text-muted">({ev.count}/{MAX_EVIDENCE})</span>
          </Label>
          <EvidencePicker ev={ev} />
        </div>
        <Button type="submit" loading={saving}>
          Marcar como completada
        </Button>
      </form>
    </Modal>
  );
}
