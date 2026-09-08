"use client";

import { useState } from "react";
import { apiSend } from "@/lib/api";
import { Input, Button } from "@/components/ui/Field";

// Selector de evidencia reutilizable: archivos y/o enlaces, con tope
// compartido. Lo usan "Completar actividad" y "Resolver el caso".

export const MAX_EVIDENCE = 10;

// Valida un enlace de evidencia en el cliente (el servidor vuelve a validar).
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

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

export type EvidenceState = ReturnType<typeof useEvidence>;

// Estado de la evidencia (archivos + enlaces) y sus operaciones.
export function useEvidence() {
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFiles([]);
    setLinks([]);
    setLinkDraft("");
    setError(null);
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Añade archivos respetando el tope compartido; deduplica por (nombre, tamaño).
  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    setError(null);
    const linkCount = links.length;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}|${f.size}`));
      const merged = [...prev];
      for (const f of incoming) {
        const k = `${f.name}|${f.size}`;
        if (seen.has(k)) continue;
        if (merged.length + linkCount >= MAX_EVIDENCE) {
          setError(`Solo puedes adjuntar hasta ${MAX_EVIDENCE} evidencias entre archivos y enlaces.`);
          break;
        }
        seen.add(k);
        merged.push(f);
      }
      return merged;
    });
  }

  // Añade el enlace escrito respetando el tope compartido; deduplica por URL.
  function addLink() {
    const url = normalizeUrl(linkDraft);
    if (!url) return setError("Indica un enlace válido que empiece por http:// o https://");
    if (links.includes(url)) return setError("Ese enlace ya está en la lista.");
    if (files.length + links.length >= MAX_EVIDENCE) {
      return setError(`Solo puedes adjuntar hasta ${MAX_EVIDENCE} evidencias entre archivos y enlaces.`);
    }
    setError(null);
    setLinks((prev) => [...prev, url]);
    setLinkDraft("");
  }

  // Ctrl+V con imágenes en el portapapeles las adjunta directo (Win+Shift+S
  // → pegar). Pastes de texto pasan tal cual a los inputs.
  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pasted: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) pasted.push(f);
      }
    }
    if (pasted.length > 0) {
      e.preventDefault();
      addFiles(pasted);
    }
  }

  // Valida y devuelve la evidencia a enviar. Si el usuario dejó un enlace
  // escrito sin pulsar "Añadir", lo toma igualmente. Lanza Error si no es válida.
  function collect(): { files: File[]; links: string[] } {
    const pendingLink = linkDraft.trim() ? normalizeUrl(linkDraft) : null;
    if (linkDraft.trim() && !pendingLink) {
      throw new Error("Indica un enlace válido que empiece por http:// o https://");
    }
    const allLinks = pendingLink && !links.includes(pendingLink) ? [...links, pendingLink] : links;
    if (files.length === 0 && allLinks.length === 0) {
      throw new Error("Adjunta al menos un archivo o un enlace de evidencia.");
    }
    if (files.length + allLinks.length > MAX_EVIDENCE) {
      throw new Error(`Solo puedes adjuntar hasta ${MAX_EVIDENCE} evidencias entre archivos y enlaces.`);
    }
    return { files, links: allLinks };
  }

  return {
    files, links, linkDraft, setLinkDraft, error, setError,
    count: files.length + links.length,
    reset, removeFile, removeLink, addFiles, addLink, handlePaste, collect,
  };
}

// Sube archivos y registra enlaces en paralelo contra /api/attachments.
// Devuelve cuántos fallaron y el primer mensaje de error; el resto ya quedó
// guardado en la entidad.
export async function uploadEvidence(
  entityType: string,
  entityId: string,
  files: File[],
  links: string[],
): Promise<{ total: number; failed: number; firstError: string | null }> {
  const uploads = files.map(async (f) => {
    const form = new FormData();
    form.append("entityType", entityType);
    form.append("entityId", entityId);
    form.append("file", f);
    const up = await fetch("/api/attachments", { method: "POST", body: form });
    if (!up.ok) {
      const d = await up.json().catch(() => ({}));
      throw new Error(d.error ?? `No se pudo subir ${f.name}`);
    }
  });
  const linkSaves = links.map((url) =>
    apiSend("/api/attachments", "POST", { entityType, entityId, url }),
  );
  const results = await Promise.allSettled([...uploads, ...linkSaves]);
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  return {
    total: results.length,
    failed: rejected.length,
    firstError: rejected[0]?.reason instanceof Error ? rejected[0].reason.message : rejected.length ? "Error" : null,
  };
}

// UI del selector: lista de archivos/enlaces, input de archivo y de enlace.
export function EvidencePicker({ ev, idPrefix = "evidence" }: { ev: EvidenceState; idPrefix?: string }) {
  const canAddMore = ev.count < MAX_EVIDENCE;
  return (
    <div>
      {ev.files.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {ev.files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-brand/40 bg-brand-soft/40 px-3 py-2 text-sm"
            >
              <span aria-hidden>{fileIcon(f.type)}</span>
              <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="shrink-0 text-xs text-muted">{humanSize(f.size)}</span>
              <button
                type="button"
                onClick={() => ev.removeFile(i)}
                className="shrink-0 text-xs text-muted transition-colors hover:text-danger"
                aria-label={`Quitar ${f.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {ev.links.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {ev.links.map((url, i) => (
            <div
              key={url}
              className="flex items-center gap-2 rounded-lg border border-brand/40 bg-brand-soft/40 px-3 py-2 text-sm"
            >
              <span aria-hidden>🔗</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate hover:text-brand hover:underline"
                title={url}
              >
                {url}
              </a>
              <button
                type="button"
                onClick={() => ev.removeLink(i)}
                className="shrink-0 text-xs text-muted transition-colors hover:text-danger"
                aria-label={`Quitar enlace ${url}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {canAddMore && (
        <input
          id={`${idPrefix}-file`}
          type="file"
          multiple
          onChange={(e) => {
            ev.addFiles(e.target.files ? Array.from(e.target.files) : []);
            // El input se limpia siempre: la lista de archivos vive en el estado.
            e.target.value = "";
          }}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:brightness-105"
        />
      )}
      {canAddMore && (
        <div className="mt-2 flex gap-2">
          <Input
            id={`${idPrefix}-link`}
            type="url"
            inputMode="url"
            value={ev.linkDraft}
            onChange={(e) => ev.setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                ev.addLink();
              }
            }}
            placeholder="O pega un enlace: https://…"
            aria-label="Enlace de evidencia"
          />
          <Button type="button" variant="ghost" className="w-auto shrink-0" onClick={ev.addLink}>
            Añadir enlace
          </Button>
        </div>
      )}
      <p className="mt-1 text-xs text-muted">
        Imagen, PDF, documento u hoja de cálculo · máx. 15 MB por archivo, o enlaces (Drive, Notion, Figma…) ·
        hasta {MAX_EVIDENCE} evidencias en total. Tip: puedes <b>pegar (Ctrl+V)</b> capturas tomadas con Win+Shift+S.
      </p>
    </div>
  );
}
