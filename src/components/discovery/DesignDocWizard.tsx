"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Inputs";
import { Modal } from "@/components/ui/Modal";
import { DESIGN_SECTIONS } from "@/lib/designDocSections";

type Version = { id: string; version: number; changeNote: string | null; createdAt: string };
type DocComment = { id: string; body: string; version: number; createdAt: string; author: { id: string; name: string } | null };
type Doc = {
  id: string;
  title: string;
  status: "DRAFT" | "SENT" | "APPROVED";
  currentVersion: number;
  approvedAt: string | null;
  project: { id: string; name: string; client: { name: string } };
  versions: Version[];
  comments: DocComment[];
  current: { answers: Record<string, string> };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Borrador", cls: "bg-slate-500/15 text-slate-400" },
  SENT: { label: "Enviado al cliente", cls: "bg-sky-500/15 text-sky-400" },
  APPROVED: { label: "Aprobado por el cliente", cls: "bg-green-500/15 text-green-500" },
};

export function DesignDocWizard({ docId }: { docId: string }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [title, setTitle] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const load = useCallback(async () => {
    const d = await apiGet<Doc>(`/api/design-docs/${docId}`);
    setDoc(d);
    setTitle(d.title);
    setAnswers(d.current?.answers ?? {});
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      await apiSend(`/api/design-docs/${docId}`, "PATCH", { title, answers });
      setSavedAt(new Date().toLocaleTimeString("es"));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: "SENT" | "APPROVED") {
    await save();
    await apiSend(`/api/design-docs/${docId}`, "PATCH", { status });
    await load();
  }

  async function newVersion() {
    await save();
    await apiSend(`/api/design-docs/${docId}/versions`, "POST", { changeNote: changeNote || null });
    setChangeNote("");
    setVersionOpen(false);
    await load();
    setStep(0);
  }

  if (!doc) return <p className="text-sm text-muted">Cargando documento…</p>;

  const section = DESIGN_SECTIONS[step];
  const filled = DESIGN_SECTIONS.filter((s) => (answers[s.key] ?? "").trim()).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Panel principal: wizard */}
      <div className="space-y-4 lg:col-span-3">
        <div>
          <Link href="/discovery" className="text-xs text-muted hover:underline">
            ← Documentos de diseño
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS[doc.status].cls}`}>
              {STATUS[doc.status].label}
            </span>
            <span className="text-xs text-muted">Versión {doc.currentVersion}</span>
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 text-lg font-semibold" />
          <p className="mt-1 text-sm text-muted">
            {doc.project.name} · {doc.project.client.name}
          </p>
        </div>

        {/* Progreso */}
        <div className="flex flex-wrap gap-1">
          {DESIGN_SECTIONS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              title={s.title}
              className={`h-2 flex-1 min-w-[14px] rounded-full transition ${
                i === step
                  ? "bg-brand"
                  : (answers[s.key] ?? "").trim()
                    ? "bg-brand/40"
                    : "bg-border"
              }`}
            />
          ))}
        </div>

        {/* Sección actual */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold">{section.title}</h2>
            <span className="text-xs text-muted">
              {step + 1} / {DESIGN_SECTIONS.length}
            </span>
          </div>
          <p className="mb-3 text-sm text-muted">{section.help}</p>
          {section.confidential && (
            <p className="mb-2 text-xs text-warning">Confidencial · uso interno (se marca así en el PDF)</p>
          )}
          <Textarea
            value={answers[section.key] ?? ""}
            onChange={(e) => setAnswers({ ...answers, [section.key]: e.target.value })}
            placeholder={section.placeholder}
            className="min-h-[220px] font-mono text-[13px]"
          />
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="ghost"
              className="w-auto px-4"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              ← Anterior
            </Button>
            <Button
              variant="ghost"
              className="w-auto px-4"
              disabled={step === DESIGN_SECTIONS.length - 1}
              onClick={() => setStep((s) => Math.min(DESIGN_SECTIONS.length - 1, s + 1))}
            >
              Siguiente →
            </Button>
            <Button onClick={save} loading={saving} className="ml-auto w-auto px-5">
              Guardar borrador
            </Button>
          </div>
          {savedAt && <p className="mt-2 text-right text-xs text-muted">Guardado a las {savedAt}</p>}
        </div>
      </div>

      {/* Panel lateral: acciones + versiones */}
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Documento</h2>
          <p className="text-xs text-muted">{filled} de {DESIGN_SECTIONS.length} secciones con contenido</p>
          <a
            href={`/api/design-docs/${docId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-brand px-4 py-2 text-center text-sm font-medium text-brand-fg hover:opacity-90"
          >
            Descargar PDF
          </a>
          <Button variant="ghost" className="w-full" onClick={() => setVersionOpen(true)}>
            Nueva versión
          </Button>
        </div>

        <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Estado</h2>
          <Button
            variant={doc.status === "SENT" ? "primary" : "ghost"}
            className="w-full"
            onClick={() => setStatus("SENT")}
          >
            Marcar como enviado
          </Button>
          <Button
            variant={doc.status === "APPROVED" ? "primary" : "ghost"}
            className="w-full"
            onClick={() => setStatus("APPROVED")}
          >
            Marcar como aprobado
          </Button>
        </div>

        {/* Comentarios del cliente (retroalimentación para los avances) */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Comentarios del cliente
          </h2>
          {doc.comments.length === 0 ? (
            <p className="text-xs text-muted">
              Sin comentarios del cliente. Aparecerán aquí cuando deje retroalimentación en su portal.
            </p>
          ) : (
            <ul className="space-y-2">
              {doc.comments.map((c) => (
                <li key={c.id} className="rounded-lg border border-border bg-background p-2 text-sm">
                  <div className="mb-0.5 flex items-center justify-between text-[11px] text-muted">
                    <span>{c.author?.name ?? "Cliente"}</span>
                    <span>
                      {new Date(c.createdAt).toLocaleDateString("es")} · v{c.version}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-xs">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Historial de versiones</h2>
          <ul className="space-y-2 text-sm">
            {doc.versions.map((v) => (
              <li key={v.id} className="flex items-start gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs ${v.version === doc.currentVersion ? "bg-brand/15 text-brand" : "bg-background text-muted"}`}>
                  v{v.version}
                </span>
                <span className="text-xs text-muted">
                  {v.changeNote || (v.version === 1 ? "Versión inicial" : "Sin nota")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Modal open={versionOpen} onClose={() => setVersionOpen(false)} title="Nueva versión">
        <p className="mb-3 text-sm text-muted">
          Se guardará el contenido actual y se creará la versión {doc.currentVersion + 1}
          (copia editable para reflejar ajustes del cliente).
        </p>
        <Textarea
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="Nota de cambios (ej: ajustes tras revisión del cliente)…"
        />
        <Button onClick={newVersion} className="mt-3 w-full">
          Crear versión {doc.currentVersion + 1}
        </Button>
      </Modal>
    </div>
  );
}
