import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";

// ---- SCRUM: esfuerzo por sprint (horas estimadas comprometidas vs completadas) ----
export async function sprintVelocity(projectId: string) {
  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { startDate: "asc" },
    include: {
      stories: { select: { status: true, estimateHours: true } },
    },
  });
  return sprints.map((s) => {
    const committed = s.stories.reduce((a, st) => a + (st.estimateHours ?? 0), 0);
    const completed = s.stories
      .filter((st) => st.status === "DONE")
      .reduce((a, st) => a + (st.estimateHours ?? 0), 0);
    return { id: s.id, name: s.name, committed, completed };
  });
}

// ---- SCRUM: distribución de historias por estado ----
export async function storyStatusBreakdown(projectId: string) {
  const rows = await prisma.userStory.groupBy({
    by: ["status"],
    where: { projectId },
    _count: { _all: true },
    _sum: { estimateHours: true },
  });
  const map: Record<string, { count: number; hours: number }> = {};
  for (const r of rows) {
    map[r.status] = { count: r._count._all, hours: r._sum.estimateHours ?? 0 };
  }
  return map;
}

// ---- SCRUM: burndown de un sprint (puntos restantes por día) ----
// Aproximación: usa la fecha de última actualización de las historias DONE
// como fecha de completado.
export async function sprintBurndown(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { stories: { select: { estimateHours: true, status: true, updatedAt: true } } },
  });
  if (!sprint) return null;

  const total = sprint.stories.reduce((a, s) => a + (s.estimateHours ?? 0), 0);
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const days: { date: string; ideal: number; remaining: number }[] = [];

  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs));

  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(start.getTime() + i * dayMs);
    const completedByDay = sprint.stories
      .filter((s) => s.status === "DONE" && new Date(s.updatedAt).getTime() <= d.getTime() + dayMs)
      .reduce((a, s) => a + (s.estimateHours ?? 0), 0);
    days.push({
      date: d.toISOString().slice(0, 10),
      ideal: Math.round((total * (totalDays - i)) / totalDays),
      remaining: total - completedByDay,
    });
  }
  return { total, days, name: sprint.name };
}

// ---- Mesa de servicio: métricas ----
export async function serviceDeskMetrics(where: Prisma.TicketWhereInput = {}) {
  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      status: true,
      priority: true,
      resolutionDueAt: true,
      resolvedAt: true,
      csatScore: true,
    },
  });

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let slaMet = 0;
  let slaMeasured = 0;
  let csatSum = 0;
  let csatCount = 0;

  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    if (t.resolvedAt && t.resolutionDueAt) {
      slaMeasured++;
      if (t.resolvedAt.getTime() <= t.resolutionDueAt.getTime()) slaMet++;
    }
    if (t.csatScore != null) {
      csatSum += t.csatScore;
      csatCount++;
    }
  }

  const open = tickets.filter(
    (t) => !["RESOLVED", "CLOSED"].includes(t.status),
  ).length;

  return {
    total: tickets.length,
    open,
    byStatus,
    byPriority,
    slaCompliance: slaMeasured ? Math.round((slaMet / slaMeasured) * 100) : null,
    csatAvg: csatCount ? Math.round((csatSum / csatCount) * 10) / 10 : null,
  };
}
