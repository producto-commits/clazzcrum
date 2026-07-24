"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Button } from "@/components/ui/Field";
import { Select, Textarea, PRIORITY_LABELS, PRIORITY_CLASSES } from "@/components/ui/Inputs";
import { Modal } from "@/components/ui/Modal";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_CLASSES,
  slaState,
  SLA_LABELS,
  SLA_CLASSES,
  type TicketStatus,
} from "@/lib/ticketTypes";

type Msg = { id: string; body: string; visibility: "PUBLIC" | "INTERNAL"; createdAt: string; user: { id: string; name: string } | null };
type Detail = {
  id: string;
  number?: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  csatScore: number | null;
  createdAt: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  client: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  reporter: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  linkedStory: { id: string; title: string; projectId: string } | null;
  messages: Msg[];
  workLogs?: { id: string; durationSeconds: number; startedAt: string; endedAt: string; user: { id: string; name: string } | null }[];
};

// Formatea segundos como "2h 15m" / "45m" / "30s".
function fmtDur(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}
type UserOpt = { id: string; name: string };
type ProjectOpt = { id: string; name: string };

function SlaBadge({ label, due, done }: { label: string; due: string | null; done: string | null }) {
  const st = slaState(due, done);
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SLA_CLASSES[st]}`}>
        {SLA_LABELS[st]}
        {due && st !== "met" && ` · ${new Date(due).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
      </span>
    </div>
  );
}

export function TicketDetail({
  ticketId,
  backHref = "/service-desk",
  backLabel = "Mesa de servicio",
}: {
  ticketId: string;
  // Enlace de regreso: el portal del cliente usa /portal/soporte.
  backHref?: string;
  backLabel?: string;
}) {
  const { can } = useMe();
  const [d, setD] = useState<Detail | null>(null);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertProject, setConvertProject] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = can("edit", "ticket");
  const canConvert = can("create", "story");
  const isStaff = canEdit || can("create", "project");

  const load = useCallback(async () => {
    setD(await apiGet<Detail>(`/api/tickets/${ticketId}`));
  }, [ticketId]);

  useEffect(() => {
    load();
    apiGet<UserOpt[]>("/api/users").then(setUsers).catch(() => {});
  }, [load]);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    try {
      await apiSend(`/api/tickets/${ticketId}`, "PATCH", data);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await apiSend(`/api/tickets/${ticketId}/messages`, "POST", {
        body: reply.trim(),
        visibility: internal ? "INTERNAL" : "PUBLIC",
      });
      setReply("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitCsat(score: number) {
    await apiSend(`/api/tickets/${ticketId}/csat`, "POST", { score });
    await load();
  }

  async function openConvert() {
    const ps = await apiGet<ProjectOpt[]>("/api/projects").catch(() => []);
    setProjects(ps);
    setConvertProject(ps[0]?.id ?? "");
    setConvertOpen(true);
  }
  async function doConvert() {
    setBusy(true);
    try {
      await apiSend(`/api/tickets/${ticketId}/convert`, "POST", { projectId: convertProject });
      setConvertOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!d) return <p className="text-sm text-muted">Cargando caso…</p>;

  const showCsat = !isStaff && (d.status === "RESOLVED" || d.status === "CLOSED");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Columna principal: descripción + conversación */}
      <div className="space-y-5 lg:col-span-2">
        <div>
          <Link href={backHref} className="text-xs text-muted hover:underline">
            ← {backLabel}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TICKET_STATUS_CLASSES[d.status]}`}>
              {TICKET_STATUS_LABELS[d.status]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${PRIORITY_CLASSES[d.priority]}`}>
              {PRIORITY_LABELS[d.priority]}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.number != null && <span className="mr-2 font-mono text-muted">#{String(d.number).padStart(3, "0")}</span>}{d.subject}</h1>
          <p className="text-sm text-muted">
            {d.client.name}
            {d.reporter && ` · reportó ${d.reporter.name}`}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 text-sm whitespace-pre-wrap">
          {d.description}
        </div>

        {/* Conversación */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Conversación</h2>
          <div className="space-y-2">
            {d.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border p-3 text-sm ${
                  m.visibility === "INTERNAL"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-foreground">{m.user?.name ?? "—"}</span>
                  {m.visibility === "INTERNAL" && (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-500">Nota interna</span>
                  )}
                  <span className="ml-auto">
                    {new Date(m.createdAt).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
            {d.messages.length === 0 && <p className="text-xs text-muted">Sin respuestas todavía.</p>}
          </div>

          {/* Responder */}
          <div className="mt-3 rounded-xl border border-border bg-surface p-3">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={internal ? "Nota interna (no visible para el cliente)…" : "Escribe una respuesta…"}
            />
            <div className="mt-2 flex items-center gap-3">
              {canEdit && (
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Nota interna
                </label>
              )}
              <Button onClick={sendReply} loading={busy} className="ml-auto w-auto px-4">
                Enviar
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Columna lateral: gestión + SLA */}
      <div className="space-y-4">
        {/* SLA */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">SLA</h2>
          <SlaBadge label="Primera respuesta" due={d.firstResponseDueAt} done={d.firstRespondedAt} />
          <SlaBadge label="Resolución" due={d.resolutionDueAt} done={d.resolvedAt} />
        </div>

        {/* Tiempo de ejecución registrado (solo staff) */}
        {isStaff && d.workLogs && d.workLogs.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Tiempo de ejecución</h2>
            <div className="mb-2 text-2xl font-semibold text-brand">
              {fmtDur(d.workLogs.reduce((s, w) => s + w.durationSeconds, 0))}
            </div>
            <ul className="space-y-1 text-xs text-muted">
              {d.workLogs.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{w.user?.name ?? "—"}</span>
                  <span className="font-mono">{fmtDur(w.durationSeconds)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gestión (staff) */}
        {canEdit && (
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Gestión</h2>
            <div>
              <label className="mb-1 block text-xs text-muted">Estado</label>
              <Select value={d.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })}>
                {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Asignado a</label>
              <Select value={d.assignee?.id ?? ""} disabled={busy} onChange={(e) => patch({ assigneeId: e.target.value || null })}>
                <option value="">— sin asignar —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Prioridad</label>
              <Select value={d.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value })}>
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </Select>
            </div>

            {d.linkedStory ? (
              <div className="rounded-lg border border-border bg-background p-2 text-xs">
                Vinculado a actividad:{" "}
                <Link href={`/projects/${d.linkedStory.projectId}`} className="text-brand hover:underline">
                  {d.linkedStory.title}
                </Link>
              </div>
            ) : (
              canConvert && (
                <Button variant="ghost" onClick={openConvert} className="w-full">
                  Convertir en historia
                </Button>
              )
            )}
          </div>
        )}

        {/* CSAT */}
        {(showCsat || d.csatScore != null) && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Satisfacción</h2>
            {d.csatScore != null ? (
              <div className="text-sm">Calificación: {"★".repeat(d.csatScore)}{"☆".repeat(5 - d.csatScore)}</div>
            ) : (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => submitCsat(n)}
                    className="text-2xl text-amber-500 hover:scale-110"
                    aria-label={`${n} estrellas`}
                  >
                    ☆
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={convertOpen} onClose={() => setConvertOpen(false)} title="Convertir en actividad">
        <p className="mb-3 text-sm text-muted">
          Se creará una historia en el proyecto elegido, vinculada a este caso.
        </p>
        <Select value={convertProject} onChange={(e) => setConvertProject(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button onClick={doConvert} loading={busy} disabled={!convertProject} className="mt-3 w-full">
          Crear historia vinculada
        </Button>
      </Modal>
    </div>
  );
}
