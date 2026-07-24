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

export function storyCompliance(
  status: string,
  estimatedEnd: string | null,
  actualEnd: string | null,
): Compliance {
  if (!estimatedEnd) return "none";
  const end = new Date(estimatedEnd).getTime();
  if (status === "DONE") {
    const done = actualEnd ? new Date(actualEnd).getTime() : Date.now();
    return done > end ? "late" : "ontime";
  }
  const now = Date.now();
  if (now > end) return "overdue";
  if (end - now < 2 * 24 * 60 * 60 * 1000) return "due_soon"; // < 2 días
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
