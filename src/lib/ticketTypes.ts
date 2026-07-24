export type TicketStatus =
  | "NEW"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_CLIENT"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "Nuevo",
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En proceso",
  WAITING_CLIENT: "En espera del cliente",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
  REOPENED: "Reabierto",
};

export const TICKET_STATUS_CLASSES: Record<TicketStatus, string> = {
  NEW: "bg-sky-500/15 text-sky-400",
  ASSIGNED: "bg-indigo-500/15 text-indigo-400",
  IN_PROGRESS: "bg-amber-500/15 text-amber-500",
  WAITING_CLIENT: "bg-purple-500/15 text-purple-400",
  RESOLVED: "bg-green-500/15 text-green-500",
  CLOSED: "bg-slate-500/15 text-slate-400",
  REOPENED: "bg-red-500/15 text-red-400",
};

// Estado de un SLA para mostrar indicador visual.
export type SlaState = "met" | "ok" | "soon" | "overdue" | "none";

export function slaState(dueAt: string | null, doneAt: string | null): SlaState {
  if (!dueAt) return "none";
  if (doneAt) return "met";
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  if (now > due) return "overdue";
  if (due - now < 2 * 60 * 60 * 1000) return "soon"; // < 2h
  return "ok";
}

export const SLA_LABELS: Record<SlaState, string> = {
  met: "Cumplido",
  ok: "En tiempo",
  soon: "Por vencer",
  overdue: "Vencido",
  none: "—",
};

export const SLA_CLASSES: Record<SlaState, string> = {
  met: "bg-green-500/15 text-green-500",
  ok: "bg-slate-500/15 text-slate-400",
  soon: "bg-amber-500/15 text-amber-500",
  overdue: "bg-red-500/15 text-red-400",
  none: "bg-slate-500/10 text-muted",
};

export type TicketRow = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  client: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  _count: { messages: number };
};
