import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/portal";
import { ok, fail } from "@/server/http";

// GET /api/daily?date=YYYY-MM-DD — vista del daily para el LÍDER.
// Centrada en el DESARROLLADOR: sus proyectos, lo que ejecutó ese día,
// lo que tiene en curso y sus bloqueos. La fecha es navegable (dinámica).
export async function GET(req: Request) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  if (auth.scope.assignedOnly) return fail("Solo para líderes y administradores", 403);

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Fecha seleccionada (por defecto: ayer). Nunca en el futuro.
  const param = new URL(req.url).searchParams.get("date");
  let dayStart = new Date(todayUTC.getTime() - 86400000);
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const parsed = new Date(`${param}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      dayStart = parsed.getTime() > todayUTC.getTime() ? todayUTC : parsed;
    }
  }
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const sel = {
    id: true,
    title: true,
    status: true,
    priority: true,
    estimateHours: true,
    spentHours: true,
    blockReason: true,
    blockedAt: true,
    blockedDays: true,
    actualEnd: true,
    estimatedEnd: true,
    project: { select: { id: true, name: true } },
    assignees: { select: { user: { select: { id: true, name: true, jobTitle: true } } } },
  };

  const [stories, ticketsResolved, projects] = await Promise.all([
    prisma.userStory.findMany({
      where: { project: { status: { in: ["PLANNING", "ACTIVE"] } } },
      select: sel,
      take: 3000,
    }),
    prisma.ticket.findMany({
      where: { resolvedAt: { gte: dayStart, lt: dayEnd } },
      select: { id: true, number: true, subject: true, assignee: { select: { id: true, name: true } } },
    }),
    prisma.project.findMany({
      where: { status: { in: ["PLANNING", "ACTIVE"] } },
      select: { id: true, name: true, plannedEndAt: true, stories: { select: { status: true } } },
      take: 40,
    }),
  ]);

  // Resumen global de proyectos (para el encabezado).
  const projectSummary = projects
    .filter((p) => p.stories.length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      plannedEndAt: p.plannedEndAt,
      total: p.stories.length,
      done: p.stories.filter((s) => s.status === "DONE").length,
    }));

  type StoryOut = {
    id: string;
    title: string;
    status: string;
    priority: string;
    estimateHours: number | null;
    spentHours: number;
    blockReason: string | null;
    blockedAt: string | null;
    blockedDays: number;
    project: { id: string; name: string };
  };
  type ProjChip = { id: string; name: string; total: number; done: number; active: number };
  type Dev = {
    id: string;
    name: string;
    jobTitle: string | null;
    projects: Map<string, ProjChip>;
    completed: StoryOut[];
    inProgress: StoryOut[];
    blocked: StoryOut[];
  };

  const devs = new Map<string, Dev>();
  const getDev = (id: string, name: string, jobTitle: string | null): Dev => {
    let d = devs.get(id);
    if (!d) {
      d = { id, name, jobTitle, projects: new Map(), completed: [], inProgress: [], blocked: [] };
      devs.set(id, d);
    }
    return d;
  };

  const toOut = (s: (typeof stories)[number]): StoryOut => ({
    id: s.id,
    title: s.title,
    status: s.status,
    priority: s.priority,
    estimateHours: s.estimateHours,
    spentHours: s.spentHours,
    blockReason: s.blockReason,
    blockedAt: s.blockedAt ? s.blockedAt.toISOString() : null,
    blockedDays: s.blockedDays,
    project: s.project,
  });

  for (const s of stories) {
    const targets = s.assignees.length
      ? s.assignees.map((a) => a.user)
      : [{ id: "—", name: "Sin responsable", jobTitle: null }];
    const completedThatDay =
      s.status === "DONE" && s.actualEnd && s.actualEnd >= dayStart && s.actualEnd < dayEnd;

    for (const u of targets) {
      const dev = getDev(u.id, u.name, u.jobTitle);
      // Proyectos del desarrollador (con su avance dentro de cada uno).
      let chip = dev.projects.get(s.project.id);
      if (!chip) {
        chip = { id: s.project.id, name: s.project.name, total: 0, done: 0, active: 0 };
        dev.projects.set(s.project.id, chip);
      }
      chip.total += 1;
      if (s.status === "DONE") chip.done += 1;
      if (s.status === "IN_PROGRESS" || s.status === "BLOCKED") chip.active += 1;

      if (completedThatDay) dev.completed.push(toOut(s));
      else if (s.status === "IN_PROGRESS") dev.inProgress.push(toOut(s));
      else if (s.status === "BLOCKED") dev.blocked.push(toOut(s));
    }
  }

  const developers = [...devs.values()]
    .map((d) => ({
      id: d.id,
      name: d.name,
      jobTitle: d.jobTitle,
      projects: [...d.projects.values()].sort((a, b) => b.active - a.active || a.name.localeCompare(b.name)),
      completed: d.completed,
      inProgress: d.inProgress,
      blocked: d.blocked,
    }))
    // Ocultar filas totalmente vacías (sin proyectos ni actividad relevante).
    .filter((d) => d.projects.length > 0 || d.completed.length || d.inProgress.length || d.blocked.length)
    .sort(
      (a, b) =>
        b.blocked.length - a.blocked.length ||
        b.completed.length - a.completed.length ||
        a.name.localeCompare(b.name),
    );

  const totals = {
    completed: developers.reduce((n, d) => n + d.completed.length, 0),
    inProgress: developers.reduce((n, d) => n + d.inProgress.length, 0),
    blocked: developers.reduce((n, d) => n + d.blocked.length, 0),
  };

  return ok({
    date: dayStart.toISOString(),
    isYesterday: dayStart.getTime() === todayUTC.getTime() - 86400000,
    developers,
    totals,
    ticketsResolved,
    projects: projectSummary,
  });
}
