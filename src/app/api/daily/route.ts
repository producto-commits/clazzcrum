import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/portal";
import { ok } from "@/server/http";

// GET /api/daily?date=YYYY-MM-DD — Daily del líder.
// Muestra, por desarrollador, dos días: el DÍA ANTERIOR (lo que se ejecutó,
// reuniones asistidas, tickets atendidos) y el DÍA ACTUAL (lo que está
// planificado para hoy, reuniones agendadas, tickets a atender).
// La fecha del parámetro es el día "actual" del daily; nunca futuro.
export async function GET(req: Request) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;

  // Alcance:
  //   - Líderes (admin/tech_lead): ven el daily del equipo completo.
  //   - Developer (assignedOnly=true): ve SOLO lo suyo — historias asignadas,
  //     reuniones en las que participa, tickets asignados.
  const onlyMine = auth.scope.assignedOnly;
  const meId = auth.scope.userId;

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const param = new URL(req.url).searchParams.get("date");
  let today = todayUTC;
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const parsed = new Date(`${param}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      today = parsed.getTime() > todayUTC.getTime() ? todayUTC : parsed;
    }
  }
  // "Ayer" = último día HÁBIL antes de hoy: salta fines de semana y festivos.
  // Así los lunes muestran el viernes, y un martes con lunes festivo muestra
  // el viernes también.
  const y = today.getUTCFullYear();
  const holidayRows = await prisma.holiday.findMany({
    where: {
      date: {
        gte: new Date(Date.UTC(y - 1, 0, 1)),
        lt: new Date(Date.UTC(y + 1, 0, 1)),
      },
    },
    select: { date: true },
  });
  const holidays = new Set(
    holidayRows.map((h) =>
      new Date(Date.UTC(h.date.getUTCFullYear(), h.date.getUTCMonth(), h.date.getUTCDate()))
        .toISOString()
        .slice(0, 10),
    ),
  );
  const isWorkDay = (d: Date) => {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) return false;
    return !holidays.has(d.toISOString().slice(0, 10));
  };
  let yest = new Date(today.getTime() - 86400000);
  let guard = 0;
  while (!isWorkDay(yest) && guard++ < 30) {
    yest = new Date(yest.getTime() - 86400000);
  }
  const todayEnd = new Date(today.getTime() + 86400000);

  const storySel = {
    id: true,
    title: true,
    status: true,
    priority: true,
    estimateHours: true,
    spentHours: true,
    blockReason: true,
    blockedAt: true,
    blockedDays: true,
    startDate: true,
    actualEnd: true,
    estimatedEnd: true,
    project: { select: { id: true, name: true } },
    assignees: { select: { user: { select: { id: true, name: true, jobTitle: true } } } },
  };

  const [stories, tixYest, tixToday, meetings, projects] = await Promise.all([
    // Todas las actividades de proyectos activos (para saber avance y encajar por fecha).
    prisma.userStory.findMany({
      where: {
        project: { status: { in: ["PLANNING", "ACTIVE"] } },
        ...(onlyMine ? { assignees: { some: { userId: meId } } } : {}),
      },
      select: storySel,
      take: 5000,
    }),
    // Tickets resueltos AYER.
    prisma.ticket.findMany({
      where: {
        resolvedAt: { gte: yest, lt: today },
        ...(onlyMine ? { assigneeId: meId } : {}),
      },
      select: {
        id: true, number: true, subject: true, priority: true,
        assignee: { select: { id: true, name: true } },
      },
    }),
    // Tickets abiertos HOY que quedan por atender (asignados o nuevos, sin resolver).
    prisma.ticket.findMany({
      where: {
        status: { in: ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CLIENT", "REOPENED"] },
        // Casos con SLA hoy o abiertos hoy.
        OR: [
          { createdAt: { gte: today, lt: todayEnd } },
          { resolutionDueAt: { gte: today, lt: todayEnd } },
          { firstResponseDueAt: { gte: today, lt: todayEnd } },
        ],
        ...(onlyMine ? { assigneeId: meId } : {}),
      },
      select: {
        id: true, number: true, subject: true, priority: true, status: true,
        assignee: { select: { id: true, name: true } },
      },
    }),
    // Reuniones del rango [ayer, hoy].
    prisma.meeting.findMany({
      where: {
        date: { gte: yest, lt: todayEnd },
        ...(onlyMine ? { attendees: { some: { userId: meId } } } : {}),
      },
      select: {
        id: true, title: true, date: true, hours: true,
        attendees: { select: { user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.project.findMany({
      where: {
        status: { in: ["PLANNING", "ACTIVE"] },
        ...(onlyMine
          ? {
              OR: [
                { assignments: { some: { userId: meId } } },
                { stories: { some: { assignees: { some: { userId: meId } } } } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, plannedEndAt: true, stories: { select: { status: true } } },
      take: 60,
    }),
  ]);

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
    project: { id: string; name: string };
  };
  type BlockOut = StoryOut & { blockReason: string | null; blockedAt: string | null; blockedDays: number };
  type MeetOut = { id: string; title: string; date: string; hours: number };
  type TixOut = { id: string; number: number | null; subject: string; priority: string; status?: string };
  type ProjChip = { id: string; name: string; total: number; done: number; active: number };
  type Dev = {
    id: string;
    name: string;
    jobTitle: string | null;
    projects: Map<string, ProjChip>;
    yesterday: { done: StoryOut[]; meetings: MeetOut[]; tickets: TixOut[] };
    today: { planned: StoryOut[]; done: StoryOut[]; meetings: MeetOut[]; tickets: TixOut[] };
    blocked: BlockOut[];
  };

  const devs = new Map<string, Dev>();
  const getDev = (id: string, name: string, jobTitle: string | null): Dev => {
    let d = devs.get(id);
    if (!d) {
      d = {
        id, name, jobTitle,
        projects: new Map(),
        yesterday: { done: [], meetings: [], tickets: [] },
        today: { planned: [], done: [], meetings: [], tickets: [] },
        blocked: [],
      };
      devs.set(id, d);
    }
    return d;
  };

  const asStory = (s: (typeof stories)[number]): StoryOut => ({
    id: s.id, title: s.title, status: s.status, priority: s.priority,
    estimateHours: s.estimateHours, project: s.project,
  });
  const asBlock = (s: (typeof stories)[number]): BlockOut => ({
    ...asStory(s),
    blockReason: s.blockReason,
    blockedAt: s.blockedAt ? s.blockedAt.toISOString() : null,
    blockedDays: s.blockedDays,
  });

  // Rango de un día para test start ≤ today ≤ end (inclusivo por día).
  function fallsOn(startDate: Date | null, endDate: Date | null, day: Date, dayEnd: Date): boolean {
    if (!startDate || !endDate) return false;
    return startDate < dayEnd && endDate >= day;
  }

  for (const s of stories) {
    const targets = s.assignees.length
      ? s.assignees.map((a) => a.user)
      : [{ id: "—", name: "Sin responsable", jobTitle: null }];

    // Mismo criterio para líder y developer: yer=completadas ayer,
    // hoy=planeadas hoy (dentro de la ventana startDate..estimatedEnd).
    // También registramos las completadas HOY para mostrarlas debajo de ayer.
    const completedYest =
      s.status === "DONE" && s.actualEnd && s.actualEnd >= yest && s.actualEnd < today;
    const completedToday =
      s.status === "DONE" && s.actualEnd && s.actualEnd >= today && s.actualEnd < todayEnd;
    const plannedToday =
      s.status !== "DONE" && fallsOn(s.startDate, s.estimatedEnd, today, todayEnd);

    for (const u of targets) {
      const dev = getDev(u.id, u.name, u.jobTitle);
      let chip = dev.projects.get(s.project.id);
      if (!chip) {
        chip = { id: s.project.id, name: s.project.name, total: 0, done: 0, active: 0 };
        dev.projects.set(s.project.id, chip);
      }
      chip.total += 1;
      if (s.status === "DONE") chip.done += 1;
      if (s.status === "IN_PROGRESS" || s.status === "BLOCKED") chip.active += 1;

      if (completedYest) dev.yesterday.done.push(asStory(s));
      if (completedToday) dev.today.done.push(asStory(s));
      if (plannedToday) dev.today.planned.push(asStory(s));
      if (s.status === "BLOCKED") dev.blocked.push(asBlock(s));
    }
  }

  // Reuniones — repartir por día y por asistente.
  // Si es developer viendo solo lo suyo, ignoramos a los otros asistentes.
  for (const m of meetings) {
    const isYest = m.date >= yest && m.date < today;
    const isToday = m.date >= today && m.date < todayEnd;
    if (!isYest && !isToday) continue;
    const meet: MeetOut = { id: m.id, title: m.title, date: m.date.toISOString(), hours: m.hours };
    for (const a of m.attendees) {
      if (onlyMine && a.user.id !== meId) continue;
      const dev = getDev(a.user.id, a.user.name, null);
      (isYest ? dev.yesterday : dev.today).meetings.push(meet);
    }
  }

  // Tickets — asignados al dev correspondiente.
  for (const t of tixYest) {
    const uid = t.assignee?.id ?? "—";
    if (onlyMine && uid !== meId) continue;
    const name = t.assignee?.name ?? "Sin responsable";
    const dev = getDev(uid, name, null);
    dev.yesterday.tickets.push({ id: t.id, number: t.number, subject: t.subject, priority: t.priority });
  }
  for (const t of tixToday) {
    const uid = t.assignee?.id ?? "—";
    if (onlyMine && uid !== meId) continue;
    const name = t.assignee?.name ?? "Sin responsable";
    const dev = getDev(uid, name, null);
    dev.today.tickets.push({
      id: t.id, number: t.number, subject: t.subject, priority: t.priority, status: t.status,
    });
  }

  const developers = [...devs.values()]
    .map((d) => ({
      id: d.id,
      name: d.name,
      jobTitle: d.jobTitle,
      projects: [...d.projects.values()].sort((a, b) => b.active - a.active || a.name.localeCompare(b.name)),
      yesterday: d.yesterday,
      today: d.today,
      blocked: d.blocked,
    }))
    .filter(
      (d) =>
        d.projects.length > 0 ||
        d.yesterday.done.length || d.yesterday.meetings.length || d.yesterday.tickets.length ||
        d.today.planned.length || d.today.done.length || d.today.meetings.length || d.today.tickets.length ||
        d.blocked.length,
    )
    .sort(
      (a, b) =>
        b.blocked.length - a.blocked.length ||
        b.today.planned.length - a.today.planned.length ||
        a.name.localeCompare(b.name),
    );

  const totals = {
    yesterdayDone: developers.reduce((n, d) => n + d.yesterday.done.length, 0),
    todayDone: developers.reduce((n, d) => n + d.today.done.length, 0),
    todayPlanned: developers.reduce((n, d) => n + d.today.planned.length, 0),
    blocked: developers.reduce((n, d) => n + d.blocked.length, 0),
  };

  return ok({
    today: today.toISOString(),
    yesterday: yest.toISOString(),
    isToday: today.getTime() === todayUTC.getTime(),
    developers,
    totals,
    projects: projectSummary,
  });
}
