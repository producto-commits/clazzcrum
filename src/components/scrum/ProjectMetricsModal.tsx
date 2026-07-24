"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { VelocityChart, BurndownChart, StatusBars } from "@/components/charts/Charts";
import { STORY_COLUMNS, type Sprint } from "@/lib/scrumTypes";

const STORY_COLORS: Record<string, string> = {
  BACKLOG: "#64748b",
  PLANNED: "#6366f1",
  IN_PROGRESS: "#d97706",
  QA: "#0ea5e9",
  BLOCKED: "#dc2626",
  DONE: "#16a34a",
};

type Metrics = {
  velocity: { id: string; name: string; committed: number; completed: number }[];
  statusBreakdown: Record<string, { count: number; points: number }>;
  burndown: { total: number; name: string; days: { date: string; ideal: number; remaining: number }[] } | null;
  sprintId: string | null;
};

export function ProjectMetricsModal({
  projectId,
  sprints,
  open,
  onClose,
}: {
  projectId: string;
  sprints: Sprint[];
  open: boolean;
  onClose: () => void;
}) {
  const [m, setM] = useState<Metrics | null>(null);
  const [sprintId, setSprintId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const qs = new URLSearchParams({ projectId });
    if (sprintId) qs.set("sprintId", sprintId);
    apiGet<Metrics>(`/api/metrics/scrum?${qs.toString()}`).then((data) => {
      setM(data);
      if (!sprintId && data.sprintId) setSprintId(data.sprintId);
    });
  }, [open, projectId, sprintId]);

  const statusData = STORY_COLUMNS.map((c) => ({
    label: c.label,
    value: m?.statusBreakdown[c.key]?.count ?? 0,
    color: STORY_COLORS[c.key],
  }));

  return (
    <Modal open={open} onClose={onClose} title="Métricas del proyecto" wide>
      {!m ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h4 className="mb-2 text-sm font-semibold">Esfuerzo por sprint (horas)</h4>
            <VelocityChart data={m.velocity} />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Burndown</h4>
              {sprints.length > 0 && (
                <select
                  value={sprintId}
                  onChange={(e) => setSprintId(e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                >
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {m.burndown ? (
              <BurndownChart days={m.burndown.days} />
            ) : (
              <p className="text-sm text-muted">Crea un sprint para ver el burndown.</p>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold">Historias por estado</h4>
            <StatusBars data={statusData} />
          </section>
        </div>
      )}
    </Modal>
  );
}
