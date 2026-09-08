"use client";

import { useRef, useState } from "react";
import { apiSend } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Button, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";

// Tope compartido entre archivos y enlaces.
const MAX_FILES = 10;

// Valida un enlace de evidencia en el cliente (el servidor vuelve a validar).
function normalizeUrl(raw: string): string | null {
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

// Fecha de hoy en formato YYYY-MM-DD para el input date.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [spentHours, setSpentHours] = useState("");
  const [actualEnd, setActualEnd] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEvidence("");
    setFiles([]);
    setLinks([]);
    setLinkDraft("");
    setSpentHours("");
    setActualEnd(today());
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeLinkAt(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Añade el enlace escrito respetando el tope compartido; deduplica por URL.
  function addLink() {
    const url = normalizeUrl(linkDraft);
    if (!url) return setError("Indica un enlace válido que empiece por http:// o https://");
    if (links.includes(url)) return setError("Ese enlace ya está en la lista.");
    if (files.length + links.length >= MAX_FILES) {
      return setError(`Solo puedes adjuntar hasta ${MAX_FILES} evidencias entre archivos y enlaces.`);
    }
    setError(null);
    setLinks((prev) => [...prev, url]);
    setLinkDraft("");
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
        if (merged.length + linkCount >= MAX_FILES) {
          setError(`Solo puedes adjuntar hasta ${MAX_FILES} evidencias entre archivos y enlaces.`);
          break;
        }
        seen.add(k);
        merged.push(f);
      }
      return merged;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  // Ctrl+V con imágenes en el portapapeles las adjunta directo (Win+Shift+S
  // → pegar). Pastes de texto pasan tal cual al textarea.
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!storyId) return;
    setError(null);
    if (!evidence.trim()) return setError("Describe la evidencia.");
    // Si dejó un enlace escrito sin pulsar "Añadir", lo tomamos igualmente.
    const pendingLink = linkDraft.trim() ? normalizeUrl(linkDraft) : null;
    if (linkDraft.trim() && !pendingLink) {
      return setError("Indica un enlace válido que empiece por http:// o https://");
    }
    const allLinks = pendingLink && !links.includes(pendingLink) ? [...links, pendingLink] : links;
    if (files.length === 0 && allLinks.length === 0) {
      return setError("Adjunta al menos un archivo o un enlace de evidencia.");
    }
    if (files.length + allLinks.length > MAX_FILES) {
      return setError(`Solo puedes adjuntar hasta ${MAX_FILES} evidencias entre archivos y enlaces.`);
    }
    if (spentHours === "" || Number(spentHours) < 0) return setError("Indica las horas reales dedicadas.");

    setSaving(true);
    try {
      // 1) Subir archivos y registrar enlaces en paralelo; si alguno falla,
      // reportamos cuántos y con el mensaje del primer error — el resto ya
      // quedó en el storage y en la historia (Attachments).
      const uploads = files.map(async (f) => {
        const form = new FormData();
        form.append("entityType", "story");
        form.append("entityId", storyId);
        form.append("file", f);
        const up = await fetch("/api/attachments", { method: "POST", body: form });
        if (!up.ok) {
          const d = await up.json().catch(() => ({}));
          throw new Error(d.error ?? `No se pudo subir ${f.name}`);
        }
        return true;
      });
      const linkSaves = allLinks.map(async (url) => {
        await apiSend("/api/attachments", "POST", { entityType: "story", entityId: storyId, url });
        return true;
      });
      const total = uploads.length + linkSaves.length;
      const results = await Promise.allSettled([...uploads, ...linkSaves]);
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === total) {
        const msg = (failed[0] as PromiseRejectedResult).reason?.message ?? "No se pudieron subir los adjuntos";
        throw new Error(msg);
      }
      if (failed.length > 0) {
        // Éxito parcial: seguimos con el resto — dejamos aviso pero cerramos.
        const first = (failed[0] as PromiseRejectedResult).reason?.message ?? "";
        setError(`Se registraron ${total - failed.length}/${total} evidencias. Falló: ${first}`);
      }

      // 2) Marcar completada con la evidencia + horas reales + fecha de fin
      await apiSend(`/api/stories/${storyId}`, "PATCH", {
        status: "DONE",
        completionEvidence: evidence.trim(),
        spentHours: Number(spentHours),
        actualEnd,
      });
      if (failed.length === 0) reset();
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const attached = files.length + links.length;
  const canAddMore = attached < MAX_FILES;

  return (
    <Modal open={open} onClose={onClose} title="Completar actividad">
      <p className="mb-4 text-sm text-muted">
        Para marcar {storyTitle ? <span className="font-medium text-foreground">“{storyTitle}”</span> : "esta actividad"} como
        completada, registra la evidencia del trabajo realizado.
      </p>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit} onPaste={handlePaste} className="space-y-4">
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
          <Label htmlFor="file">
            Adjuntos de evidencia (archivo o enlace) *{" "}
            <span className="text-xs text-muted">({attached}/{MAX_FILES})</span>
          </Label>
          {files.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${f.size}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-brand/40 bg-brand-soft/40 px-3 py-2 text-sm"
                >
                  <span aria-hidden>{fileIcon(f.type)}</span>
                  <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
                  <span className="shrink-0 text-xs text-muted">{humanSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="shrink-0 text-xs text-muted transition-colors hover:text-danger"
                    aria-label={`Quitar ${f.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {links.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {links.map((url, i) => (
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
                    onClick={() => removeLinkAt(i)}
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
              id="file"
              ref={fileRef}
              type="file"
              multiple
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                addFiles(list);
              }}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:brightness-105"
            />
          )}
          {canAddMore && (
            <div className="mt-2 flex gap-2">
              <Input
                id="evidence-link"
                type="url"
                inputMode="url"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
                placeholder="O pega un enlace: https://…"
                aria-label="Enlace de evidencia"
              />
              <Button type="button" variant="ghost" className="w-auto shrink-0" onClick={addLink}>
                Añadir enlace
              </Button>
            </div>
          )}
          <p className="mt-1 text-xs text-muted">
            Imagen, PDF, documento u hoja de cálculo · máx. 15 MB por archivo, o enlaces (Drive, Notion, Figma…) ·
            hasta {MAX_FILES} evidencias en total. Tip: puedes <b>pegar (Ctrl+V)</b> capturas tomadas con Win+Shift+S.
          </p>
        </div>
        <Button type="submit" loading={saving}>
          Marcar como completada
        </Button>
      </form>
    </Modal>
  );
}
