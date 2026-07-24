"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { StatCard, StatusBars } from "@/components/charts/Charts";
import { STORY_COLUMNS } from "@/lib/scrumTypes";
import { TICKET_STATUS_LABELS, type TicketStatus } from "@/lib/ticketTypes";

type Overview = {
  isStaff: boolean;
  projects: { total: number; active: number };
  stories: { total: number; done: number; inProgress: number; blocked: number; byStatus: Record<string, number> };
  serviceDesk: {
    total: number;
    open: number;
    byStatus: Record<string, number>;
    slaCompliance: number | null;
    csatAvg: number | null;
  };
};

const STORY_COLORS: Record<string, string> = {
  BACKLOG: "#64748b",
  PLANNED: "#6366f1",
  IN_PROGRESS: "#d97706",
  QA: "#0ea5e9",
  BLOCKED: "#dc2626",
  DONE: "#16a34a",
};
const TICKET_COLORS: Record<string, string> = {
  NEW: "#0ea5e9",
  ASSIGNED: "#6366f1",
  IN_PROGRESS: "#d97706",
  WAITING_CLIENT: "#a855f7",
  RESOLVED: "#16a34a",
  CLOSED: "#64748b",
  REOPENED: "#dc2626",
};

export default function DashboardPage() {
  const { me } = useMe();
  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Overview>("/api/metrics/overview")
      .then(setOv)
      .finally(() => setLoading(false));
  }, []);

  const storyBars = STORY_COLUMNS.map((c) => ({
    label: c.label,
    value: ov?.stories.byStatus[c.key] ?? 0,
    color: STORY_COLORS[c.key],
  }));
  const ticketBars = (Object.keys(TICKET_STATUS_LABELS) as TicketStatus[])
    .map((k) => ({ label: TICKET_STATUS_LABELS[k], value: ov?.serviceDesk.byStatus[k] ?? 0, color: TICKET_COLORS[k] }))
    .filter((b) => b.value > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{me ? `, ${me.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-sm text-muted">Resumen de tu actividad en Clazz.</p>
      </div>

      {loading || !ov ? (
        <p className="text-sm text-muted">Cargando métricas…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Proyectos activos" value={ov.projects.active} sub={`${ov.projects.total} en total`} />
            <StatCard label="Actividades en curso" value={ov.stories.inProgress} sub={`${ov.stories.total} en total`} />
            <StatCard label="Casos abiertos" value={ov.serviceDesk.open} sub={`${ov.serviceDesk.total} en total`} />
            <StatCard
              label="Cumplimiento SLA"
              value={ov.serviceDesk.slaCompliance != null ? `${ov.serviceDesk.slaCompliance}%` : "—"}
              accent
            />
            <StatCard label="CSAT promedio" value={ov.serviceDesk.csatAvg != null ? `${ov.serviceDesk.csatAvg} ★` : "—"} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Actividades por estado</h2>
              {ov.stories.total === 0 ? (
                <p className="text-sm text-muted">Aún no hay actividades.</p>
              ) : (
                <StatusBars data={storyBars} />
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Casos por estado</h2>
              {ov.serviceDesk.total === 0 ? (
                <p className="text-sm text-muted">Aún no hay casos.</p>
              ) : (
                <StatusBars data={ticketBars} />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
