"use client";

import { useRouter } from "next/navigation";
import { PRIORITY_LABELS, PRIORITY_CLASSES } from "@/components/ui/Inputs";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_CLASSES,
  slaState,
  SLA_LABELS,
  SLA_CLASSES,
  type TicketRow,
} from "@/lib/ticketTypes";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

// Ficha de caso estilo "team queue": número, prioridad, resumen, metadatos,
// accesos rápidos y responsable. Usada por la mesa de servicio (staff) y el
// portal del cliente.
export function TicketCard({
  t,
  href,
  showClient = false,
  canAssignMe = false,
  meId,
  onAssignMe,
}: {
  t: TicketRow;
  href: string;
  // Staff ve el cliente en la ficha; el usuario final no lo necesita.
  showClient?: boolean;
  // Acceso rápido "Asignármelo" (solo staff).
  canAssignMe?: boolean;
  meId?: string;
  onAssignMe?: (id: string) => void;
}) {
  const router = useRouter();
  const resSla = slaState(t.resolutionDueAt, t.resolvedAt);
  const shortId = t.number != null ? String(t.number).padStart(3, "0") : t.id.slice(-4).toUpperCase();
  const overdue = resSla === "overdue";
  const mine = !!meId && t.assignee?.id === meId;

  return (
    <div
      onClick={() => router.push(href)}
      className="relative flex cursor-pointer flex-col rounded-2xl border border-border bg-surface transition hover:border-brand/40 hover:shadow-[var(--shadow-md)]"
    >
      {/* Punto de alerta SLA (como los puntos rosados del ejemplo) */}
      {overdue && (
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-danger ring-2 ring-background" title="SLA vencido" />
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Cabecera: número + prioridad */}
        <div className="flex items-center gap-2">
          <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted">#{shortId}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_CLASSES[t.priority]}`}>
            {PRIORITY_LABELS[t.priority]}
          </span>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${TICKET_STATUS_CLASSES[t.status]}`}>
            {TICKET_STATUS_LABELS[t.status]}
          </span>
        </div>

        {/* Título + descripción */}
        <div>
          <h3 className="line-clamp-1 font-medium leading-snug">{t.subject}</h3>
          {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.description}</p>}
        </div>

        {/* Metadatos */}
        <div className="mt-auto space-y-0.5 text-[11px] text-muted">
          <div>Abierto: {fmt(t.createdAt)}</div>
          {showClient && <div>Cliente: {t.client.name}</div>}
          {t.category && <div>Categoría: {t.category.name}</div>}
          {t.updatedAt && <div>Últ. actualización: {fmt(t.updatedAt)}</div>}
        </div>

        {/* SLA */}
        {resSla !== "none" && (
          <div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SLA_CLASSES[resSla]}`}>
              SLA: {SLA_LABELS[resSla]}
            </span>
          </div>
        )}
      </div>

      {/* Accesos rápidos */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(href);
          }}
          title="Abrir el caso"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
        </button>
        {canAssignMe && !mine && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssignMe?.(t.id);
            }}
            title="Asignármelo"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M4 20a5.5 5.5 0 0110 0" /><path d="M18 8v6M15 11h6" /></svg>
          </button>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted" title="Mensajes">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
          {t._count.messages}
        </span>
      </div>

      {/* Responsable */}
      <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
        {t.assignee ? (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
              {initials(t.assignee.name)}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">{t.assignee.name}</div>
              <div className="text-[11px] text-muted">Responsable{mine ? " (tú)" : ""}</div>
            </div>
          </>
        ) : (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border-strong text-[11px] text-muted">
              ?
            </span>
            <div className="text-sm text-muted">Sin asignar</div>
          </>
        )}
      </div>
    </div>
  );
}
