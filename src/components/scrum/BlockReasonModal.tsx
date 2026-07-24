"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Label, Button } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";

// Modal (línea visual de Clazz) para pedir el motivo al bloquear una actividad.
export function BlockReasonModal({
  open,
  storyTitle,
  onClose,
  onConfirm,
}: {
  open: boolean;
  storyTitle?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Bloquear actividad">
      <p className="mb-3 text-sm text-muted">
        Explica por qué se bloquea{storyTitle ? <span className="font-medium text-foreground"> “{storyTitle}”</span> : ""}. El
        tiempo en bloqueo se cuenta automáticamente.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="blockReason">Motivo del bloqueo *</Label>
          <Textarea
            id="blockReason"
            autoFocus
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Esperando acceso al servidor del cliente / dependencia de otra actividad…"
            className="min-h-[110px]"
          />
        </div>
        <Button type="submit" loading={busy} disabled={!reason.trim()}>
          Bloquear
        </Button>
      </form>
    </Modal>
  );
}
