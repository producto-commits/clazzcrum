"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Input, Button, Alert } from "@/components/ui/Field";

type ClientOpt = {
  id: string;
  name: string;
  parent: { id: string; name: string } | null;
};

// Modal dedicado a MOVER un proyecto entre clientes. Solo pide el cliente
// destino: buscador + tarjetas seleccionables. Guarda con PATCH clientId.
export function MoveProjectModal({
  projectId,
  currentClient,
  open,
  onClose,
  onMoved,
}: {
  projectId: string;
  currentClient: { id: string; name: string };
  open: boolean;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPick(null);
    setQuery("");
    apiGet<ClientOpt[]>("/api/clients").then(setClients).catch(() => setClients([]));
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => c.id !== currentClient.id) // no mostrar el actual
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.parent?.name ?? "").toLowerCase().includes(q)
        );
      });
  }, [clients, query, currentClient.id]);

  async function move() {
    if (!pick) return;
    setSaving(true);
    setError(null);
    try {
      await apiSend(`/api/projects/${projectId}`, "PATCH", { clientId: pick });
      onMoved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo mover");
    } finally {
      setSaving(false);
    }
  }

  const pickedName = clients.find((c) => c.id === pick)?.name;

  return (
    <Modal open={open} onClose={onClose} title="Mover proyecto">
      {error && <Alert kind="error">{error}</Alert>}
      <p className="mb-3 text-sm text-muted">
        Está en <b>{currentClient.name}</b>. Elige a qué cliente quieres moverlo.
        Sus hitos, actividades, tickets y equipo se mantienen.
      </p>

      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar cliente…"
      />

      <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
        {results.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted">
            {clients.length <= 1
              ? "No hay otros clientes registrados todavía."
              : "Ningún cliente coincide."}
          </p>
        )}
        {results.map((c) => {
          const selected = pick === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setPick(c.id)}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                selected
                  ? "border-brand bg-brand-soft"
                  : "border-transparent hover:border-brand/40 hover:bg-surface"
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                selected ? "bg-brand text-brand-fg" : "bg-brand-soft text-brand"
              }`}>
                {c.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name}</div>
                {c.parent && (
                  <div className="truncate text-[11px] text-muted">↑ {c.parent.name}</div>
                )}
              </div>
              {selected && (
                <span className="shrink-0 text-xs font-semibold text-brand">✓</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancelar
        </button>
        <Button
          className="w-auto px-4"
          onClick={move}
          disabled={!pick}
          loading={saving}
        >
          {pickedName ? `Mover a ${pickedName}` : "Mover"}
        </Button>
      </div>
    </Modal>
  );
}
