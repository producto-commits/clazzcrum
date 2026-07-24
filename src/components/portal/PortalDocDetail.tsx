"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { Button, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";

type Comment = { id: string; body: string; version: number; createdAt: string; author: { id: string; name: string } | null };
type Doc = {
  id: string;
  title: string;
  status: "SENT" | "APPROVED";
  currentVersion: number;
  approvedAt: string | null;
  project: { id: string; name: string; client: { name: string } };
  comments: Comment[];
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function PortalDocDetail({ docId }: { docId: string }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDoc(await apiGet<Doc>(`/api/portal/design-docs/${docId}`));
    } catch {
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve() {
    if (!confirm("¿Aprobar este documento? Una vez aprobado no podrás dejar más comentarios ni cambiarlo.")) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/portal/design-docs/${docId}/approve`, "POST", {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aprobar");
    } finally {
      setBusy(false);
    }
  }

  async function sendComment() {
    if (!comment.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/portal/design-docs/${docId}/comment`, "POST", { body: comment.trim() });
      setComment("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el comentario");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Cargando documento…</p>;
  if (!doc) return <p className="text-sm text-muted">No se encontró el documento.</p>;

  const approved = doc.status === "APPROVED";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/portal/documentos" className="text-xs text-muted hover:underline">
          ← Documentos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              approved ? "bg-success/15 text-success" : "bg-info/15 text-info"
            }`}
          >
            {approved ? "Aprobado" : "Pendiente de tu revisión"}
          </span>
        </div>
        <p className="text-sm text-muted">
          {doc.project.name} · versión {doc.currentVersion}
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {/* Documento en PDF (solo lectura) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <iframe
          title={`Documento ${doc.title}`}
          src={`/api/portal/design-docs/${docId}/pdf`}
          className="h-[70vh] w-full"
        />
      </div>

      {/* Acción principal */}
      {approved ? (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
          <h3 className="text-sm font-semibold text-success">✓ Documento aprobado</h3>
          <p className="mt-1 text-sm text-muted">
            Aprobaste este documento{doc.approvedAt ? ` el ${fmt(doc.approvedAt)}` : ""}. Queda cerrado y no admite
            más cambios ni comentarios. Si necesitas ajustes, escríbele al equipo de Clazz.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">¿Todo en orden?</h3>
              <p className="text-sm text-muted">Aprueba el documento o deja un comentario con los ajustes que necesites.</p>
            </div>
            <Button onClick={approve} loading={busy} className="w-auto px-5">
              ✓ Aprobar documento
            </Button>
          </div>
          <div className="border-t border-border pt-4">
            <label className="mb-1 block text-xs text-muted">Dejar un comentario (para los avances)</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escribe aquí los cambios o dudas sobre el documento…"
            />
            <div className="mt-2 flex justify-end">
              <Button onClick={sendComment} loading={busy} variant="ghost" className="w-auto px-4" disabled={!comment.trim()}>
                Enviar comentario
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Historial de comentarios */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Comentarios</h3>
        {doc.comments.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay comentarios.</p>
        ) : (
          <div className="space-y-2">
            {doc.comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                <div className="mb-0.5 flex items-center justify-between text-xs text-muted">
                  <span>{c.author?.name ?? "Cliente"}</span>
                  <span>
                    {fmt(c.createdAt)} · v{c.version}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
