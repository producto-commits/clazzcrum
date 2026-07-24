"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
};

function humanSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("word")) return "📝";
  return "📎";
}

export function Attachments({
  entityType,
  entityId,
  canEdit,
  reloadKey,
}: {
  entityType: string;
  entityId: string;
  canEdit: boolean;
  reloadKey?: number;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await apiGet<Attachment[]>(
      `/api/attachments?entityType=${entityType}&entityId=${entityId}`,
    );
    setItems(data);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("entityType", entityType);
      form.append("entityId", entityId);
      form.append("file", file);
      const res = await fetch("/api/attachments", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "No se pudo subir");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    await apiSend(`/api/attachments/${id}`, "DELETE");
    await load();
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      <div className="space-y-1.5">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm">
            <span aria-hidden>{fileIcon(a.mimeType)}</span>
            <a
              href={`/api/attachments/${a.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate hover:text-brand hover:underline"
              title={a.fileName}
            >
              {a.fileName}
            </a>
            <span className="shrink-0 text-xs text-muted">{humanSize(a.size)}</span>
            {canEdit && (
              <button
                onClick={() => remove(a.id)}
                className="shrink-0 text-xs text-muted transition-colors hover:text-danger"
                aria-label="Eliminar adjunto"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted">Sin adjuntos.</p>}
      </div>
      {canEdit && (
        <div className="mt-2">
          <input
            ref={fileRef}
            type="file"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand hover:file:brightness-105"
          />
        </div>
      )}
    </div>
  );
}
