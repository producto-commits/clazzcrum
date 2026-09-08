export type StoryStatus =
  | "BACKLOG"
  | "PLANNED"
  | "IN_PROGRESS"
  | "QA"
  | "BLOCKED"
  | "DONE";

export const STORY_COLUMNS: { key: StoryStatus; label: string }[] = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "PLANNED", label: "Planeado" },
  { key: "IN_PROGRESS", label: "En ejecución" },
  { key: "QA", label: "En pruebas / QA" },
  { key: "BLOCKED", label: "Bloqueado" },
  { key: "DONE", label: "Completado" },
];

export type Assignee = { user: { id: string; name: string } };

export type Story = {
  id: string;
  title: string;
  status: StoryStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  storyPoints: number | null;
  estimateHours: number | null;
  spentHours: number;
  tags: string[];
  epicId: string | null;
  sprintId: string | null;
  startDate: string | null;
  estimatedEnd: string | null;
  actualEnd: string | null;
  epic: { id: string; title: string } | null;
  assignees: Assignee[];
  _count: { tasks: number; comments: number; acceptanceCriteria: number };
};

// Estado de cumplimiento según fecha de fin planeada vs. realidad.
export type Compliance = "ontime" | "due_soon" | "overdue" | "late" | "none";

// Día calendario en Bogota (YYYY-MM-DD). Todas las comparaciones de
// cumplimiento se hacen a nivel de día — no de hora — para evitar que una
// tarea de "hoy" aparezca atrasada por la diferencia UTC↔Bogota (UTC-5).
function dayKeyBogota(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
// Las fechas del motor se guardan como "día UTC" a medianoche (ej. 2026-08-05T00:00:00Z),
// así que el día representado es directamente el slice(0, 10) del ISO.
function dayKeyUTC(iso: string): string {
  return iso.slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / 86_400_000);
}

export function storyCompliance(
  status: string,
  estimatedEnd: string | null,
  actualEnd: string | null,
): Compliance {
  if (!estimatedEnd) return "none";
  const endDay = dayKeyUTC(estimatedEnd);
  if (status === "DONE") {
    const doneDay = actualEnd ? dayKeyUTC(actualEnd) : dayKeyBogota(new Date());
    return doneDay > endDay ? "late" : "ontime";
  }
  const today = dayKeyBogota(new Date());
  if (today > endDay) return "overdue";
  if (daysBetween(today, endDay) < 2) return "due_soon"; // hoy o mañana
  return "ontime";
}

export const COMPLIANCE_META: Record<Compliance, { label: string; cls: string }> = {
  ontime: { label: "En tiempo", cls: "bg-success/15 text-success" },
  due_soon: { label: "Por vencer", cls: "bg-warning/15 text-warning" },
  overdue: { label: "Atrasada", cls: "bg-danger/15 text-danger" },
  late: { label: "Completada tarde", cls: "bg-danger/15 text-danger" },
  none: { label: "Sin fecha", cls: "bg-muted/15 text-muted" },
};

export type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  capacity: number | null;
  _count?: { stories: number };
};

export type Epic = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  _count?: { stories: number };
};

export type UserOpt = { id: string; name: string };
