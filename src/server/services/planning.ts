import { prisma } from "@/server/db";

// ============================================================
// MOTOR DE PLANIFICACIÓN INTELIGENTE (ver PLANIFICADOR.md)
// El usuario define Hitos ▸ Fases ▸ Actividades (horas + responsable) y la
// fecha de inicio; este motor calcula fechas por actividad, el fin del
// proyecto y genera los Sprints automáticamente.
// ============================================================

const MS_DAY = 86_400_000;

// --- utilidades de calendario (todo en UTC a medianoche) ---
function atMidnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Festivos de Colombia: cache en BD; si falta un año, se consulta la API pública.
async function ensureHolidays(years: number[]): Promise<Set<string>> {
  for (const y of years) {
    const count = await prisma.holiday.count({
      where: { date: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) } },
    });
    if (count > 0) continue;
    try {
      const res = await fetch(`https://api-colombia.com/api/v1/Holiday/year/${y}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const list = (await res.json()) as { date?: string; name?: string }[];
      const rows = (Array.isArray(list) ? list : [])
        .filter((h) => h.date)
        .map((h) => ({ date: atMidnightUTC(new Date(h.date!)), name: h.name ?? "Festivo" }));
      if (rows.length) await prisma.holiday.createMany({ data: rows, skipDuplicates: true });
    } catch {
      // Sin red: se planifica solo excluyendo fines de semana.
    }
  }
  const all = await prisma.holiday.findMany({ select: { date: true } });
  return new Set(all.map((h) => dayKey(h.date)));
}

function isWorkday(d: Date, holidays: Set<string>): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false; // fin de semana
  return !holidays.has(dayKey(d));
}
function nextWorkday(d: Date, holidays: Set<string>): Date {
  let x = d;
  while (!isWorkday(x, holidays)) x = addDays(x, 1);
  return x;
}

export type ReplanResult = {
  projectId: string;
  startDate: string;
  plannedEndAt: string | null;
  planned: number;
  unplanned: number; // sin responsable o sin horas
  sprints: number;
};

// Replanifica TODO el cronograma de un proyecto.
export async function replanProject(projectId: string): Promise<ReplanResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { assignments: true },
  });
  if (!project) throw new Error("Proyecto no encontrado");

  const start = atMidnightUTC(project.startDate ?? project.createdAt);
  const horizonYears = [start.getUTCFullYear(), start.getUTCFullYear() + 1, start.getUTCFullYear() + 2];
  const holidays = await ensureHolidays(horizonYears);

  // Actividades en orden Hito → Fase → Actividad (las completadas no se reprograman).
  const stories = await prisma.userStory.findMany({
    where: { projectId },
    include: {
      assignees: { select: { userId: true } },
      epic: { select: { createdAt: true, sprint: { select: { startDate: true, createdAt: true } } } },
    },
  });
  const orderKey = (s: (typeof stories)[number]) => [
    s.epic?.sprint?.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
    s.epic?.sprint?.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    s.epic?.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    s.createdAt.getTime(),
  ];
  stories.sort((a, b) => {
    const ka = orderKey(a), kb = orderKey(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  });

  // Capacidad por desarrollador: horas/día, % dedicación a ESTE proyecto,
  // y eventos que restan capacidad (reuniones, tickets…).
  const userIds = [...new Set(stories.flatMap((s) => s.assignees.map((a) => a.userId)))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, dailyHours: true },
  });
  const daily = new Map(users.map((u) => [u.id, u.dailyHours || 8]));
  const pct = new Map(project.assignments.map((a) => [a.userId, a.dedicationPct]));
  const events = await prisma.capacityEvent.findMany({
    where: { userId: { in: userIds }, date: { gte: start } },
    select: { userId: true, date: true, hours: true },
  });
  const eventHours = new Map<string, number>(); // `${userId}|${day}` → horas
  for (const e of events) {
    const k = `${e.userId}|${dayKey(atMidnightUTC(e.date))}`;
    eventHours.set(k, (eventHours.get(k) ?? 0) + e.hours);
  }
  // Capacidad efectiva del día para este proyecto:
  // (horas del día − eventos del día) × % de dedicación.
  function capacity(userId: string, day: Date): number {
    const base = daily.get(userId) ?? 8;
    const ev = eventHours.get(`${userId}|${dayKey(day)}`) ?? 0;
    const dedication = (pct.get(userId) ?? 100) / 100;
    return Math.max(0, (base - ev) * dedication);
  }

  // Simulación: cada desarrollador tiene un cursor (día + horas ya ocupadas).
  const cursor = new Map<string, { day: Date; used: number }>();
  let planned = 0;
  let unplanned = 0;
  let projectEnd: Date | null = null;
  const updates: { id: string; startDate: Date; estimatedEnd: Date }[] = [];

  for (const s of stories) {
    if (s.status === "DONE") continue; // conserva sus fechas reales
    const assignee = s.assignees[0]?.userId;
    const hours = s.estimateHours ?? 0;
    if (!assignee || hours <= 0) {
      unplanned++;
      continue;
    }
    const st = cursor.get(assignee) ?? { day: nextWorkday(start, holidays), used: 0 };
    let remaining = hours;
    let sDate: Date | null = null;
    let guard = 0;
    while (remaining > 0) {
      if (guard++ > 1500) break; // sin capacidad razonable (p. ej. dedicación 0%)
      const cap = capacity(assignee, st.day) - st.used;
      if (cap <= 0.001) {
        st.day = nextWorkday(addDays(st.day, 1), holidays);
        st.used = 0;
        continue;
      }
      if (sDate === null) sDate = st.day;
      const use = Math.min(cap, remaining);
      st.used += use;
      remaining -= use;
      if (remaining > 0.001) {
        st.day = nextWorkday(addDays(st.day, 1), holidays);
        st.used = 0;
      }
    }
    if (sDate === null || remaining > 0.001) {
      unplanned++;
      cursor.set(assignee, st);
      continue;
    }
    const eDate = st.day;
    cursor.set(assignee, st);
    updates.push({ id: s.id, startDate: sDate, estimatedEnd: eDate });
    if (!projectEnd || eDate > projectEnd) projectEnd = eDate;
    planned++;
  }

  // Sprints automáticos: ventanas de LUNES a DOMINGO, de N semanas cada una.
  // El Sprint 1 arranca el lunes de la semana en que inicia el proyecto.
  const weeks = Math.max(1, project.sprintWeeks || 2);
  const windows: { index: number; start: Date; end: Date }[] = [];
  if (projectEnd) {
    const firstMonday = addDays(start, -((start.getUTCDay() + 6) % 7)); // lunes de esa semana
    let winStart = firstMonday;
    let idx = 1;
    while (winStart <= projectEnd && idx <= 100) {
      const winEnd = addDays(winStart, weeks * 7 - 1); // termina domingo
      windows.push({ index: idx, start: winStart, end: winEnd });
      winStart = addDays(winEnd, 1); // siguiente lunes
      idx++;
    }
  }

  // Persistencia atómica: fechas de actividades + sprints + fin del proyecto.
  await prisma.$transaction(async (tx) => {
    await tx.planSprint.deleteMany({ where: { projectId } });
    const created = windows.length
      ? await Promise.all(
          windows.map((w) =>
            tx.planSprint.create({
              data: { projectId, index: w.index, startDate: w.start, endDate: w.end },
            }),
          ),
        )
      : [];
    const byIndex = new Map(created.map((c) => [c.index, c.id]));
    for (const u of updates) {
      const w = windows.find((x) => u.estimatedEnd >= x.start && u.estimatedEnd <= x.end);
      await tx.userStory.update({
        where: { id: u.id },
        data: {
          startDate: u.startDate,
          estimatedEnd: u.estimatedEnd,
          planSprintId: w ? byIndex.get(w.index) ?? null : null,
        },
      });
    }
    await tx.project.update({ where: { id: projectId }, data: { plannedEndAt: projectEnd } });
  });

  return {
    projectId,
    startDate: start.toISOString(),
    plannedEndAt: projectEnd?.toISOString() ?? null,
    planned,
    unplanned,
    sprints: windows.length,
  };
}

// Replanifica sin romper la petición que lo dispara.
export async function replanSafe(projectId: string | null | undefined) {
  if (!projectId) return;
  try {
    await replanProject(projectId);
  } catch (e) {
    console.error("[planning] replan falló:", e);
  }
}

// Replanifica todos los proyectos en los que participa un desarrollador.
export async function replanForUser(userId: string) {
  // Replanificar todos los proyectos DONDE el usuario tenga peso:
  // - Con ProjectAssignment (dedicación % a un proyecto), o
  // - Responsable de alguna actividad activa (no completada) del proyecto.
  // Si solo miráramos ProjectAssignment, una reunión de alguien que trabaja
  // en un proyecto sin tener % asignado NO correría el cronograma.
  const [asg, storyProjects] = await Promise.all([
    prisma.projectAssignment.findMany({ where: { userId }, select: { projectId: true } }),
    prisma.userStory.findMany({
      where: {
        status: { not: "DONE" },
        assignees: { some: { userId } },
      },
      select: { projectId: true },
      distinct: ["projectId"],
    }),
  ]);
  const ids = new Set<string>();
  asg.forEach((a) => ids.add(a.projectId));
  storyProjects.forEach((s) => ids.add(s.projectId));
  for (const projectId of ids) await replanSafe(projectId);
}
