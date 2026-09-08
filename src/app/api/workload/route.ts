import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/portal";
import { ok, fail } from "@/server/http";

// GET /api/workload?week=YYYY-MM-DD
// Vista de carga semanal por persona (para el líder). "week" es el LUNES de la
// semana pedida (default: lunes de esta semana en Bogota). Devuelve por cada
// desarrollador/líder técnico su capacidad, sus horas asignadas y un desglose
// diario para detectar sobreasignación antes de que reviente el cronograma.
const MS_DAY = 86_400_000;

function atMidnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function bogotaTodayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
function isWeekend(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

export async function GET(req: Request) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  if (auth.scope.assignedOnly) return fail("Solo para líderes y administradores", 403);

  const sp = new URL(req.url).searchParams;
  const weekParam = sp.get("week");
  // Semana = lun-dom. Calcular el lunes correspondiente.
  let anchor: Date;
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    anchor = new Date(`${weekParam}T00:00:00.000Z`);
    if (Number.isNaN(anchor.getTime())) anchor = new Date(`${bogotaTodayKey()}T00:00:00.000Z`);
  } else {
    anchor = new Date(`${bogotaTodayKey()}T00:00:00.000Z`);
  }
  const monday = addDays(atMidnightUTC(anchor), -((anchor.getUTCDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  const sundayEnd = addDays(monday, 7);

  // Días de la semana (lun..dom).
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // Festivos que caen en la semana (Colombia).
  const holidays = new Set(
    (
      await prisma.holiday.findMany({
        where: { date: { gte: monday, lte: sunday } },
        select: { date: true },
      })
    ).map((h) => dayKey(atMidnightUTC(h.date))),
  );
  const isWorkDay = (d: Date) => !isWeekend(d) && !holidays.has(dayKey(d));
  const workingDaysInWeek = days.filter(isWorkDay).length;

  // Personas contra las que medimos carga: desarrolladores y líderes técnicos activos.
  const people = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { key: { in: ["developer", "tech_lead"] } } } },
    },
    select: { id: true, name: true, jobTitle: true, dailyHours: true },
    orderBy: { name: "asc" },
  });
  const peopleIds = people.map((p) => p.id);
  if (peopleIds.length === 0) {
    return ok({ weekStart: dayKey(monday), weekEnd: dayKey(sunday), days: days.map(dayKey), people: [] });
  }

  // Actividades ACTIVAS (no completadas) con fechas del motor, que solapan con la semana.
  const stories = await prisma.userStory.findMany({
    where: {
      status: { not: "DONE" },
      startDate: { lte: sunday, not: null },
      estimatedEnd: { gte: monday, not: null },
      assignees: { some: { userId: { in: peopleIds } } },
    },
    select: {
      id: true,
      title: true,
      estimateHours: true,
      startDate: true,
      estimatedEnd: true,
      project: { select: { id: true, name: true } },
      assignees: { select: { userId: true } },
    },
  });

  // Reuniones y otros eventos que restan capacidad, dentro de la semana.
  const events = await prisma.capacityEvent.findMany({
    where: {
      userId: { in: peopleIds },
      date: { gte: monday, lt: sundayEnd },
    },
    select: { userId: true, date: true, hours: true, source: true },
  });

  // Para cada actividad calcular horas/día (uniforme sobre días hábiles del rango total).
  // Distribuir esas horas en la intersección con la semana.
  type DayEntry = { assigned: number; stories: { id: string; title: string; project: string; hours: number }[] };
  const emptyWeek = (): Record<string, DayEntry> =>
    Object.fromEntries(days.map((d) => [dayKey(d), { assigned: 0, stories: [] }]));

  const byPerson = new Map<string, Record<string, DayEntry>>();
  for (const p of peopleIds) byPerson.set(p, emptyWeek());

  for (const s of stories) {
    const hours = s.estimateHours ?? 0;
    if (hours <= 0) continue;
    const start = atMidnightUTC(s.startDate!);
    const end = atMidnightUTC(s.estimatedEnd!);
    // Días hábiles del rango COMPLETO (para repartir horas de forma pareja).
    let totalWorkDays = 0;
    for (let t = start.getTime(); t <= end.getTime(); t += MS_DAY) {
      if (isWorkDay(new Date(t))) totalWorkDays++;
    }
    if (totalWorkDays === 0) continue;
    const hoursPerDay = hours / totalWorkDays;

    for (const uid of s.assignees.map((a) => a.userId)) {
      const week = byPerson.get(uid);
      if (!week) continue;
      for (const d of days) {
        if (!isWorkDay(d)) continue;
        if (d < start || d > end) continue;
        const k = dayKey(d);
        week[k].assigned += hoursPerDay;
        week[k].stories.push({
          id: s.id,
          title: s.title,
          project: s.project.name,
          hours: Math.round(hoursPerDay * 100) / 100,
        });
      }
    }
  }

  // Suma de eventos por persona-día (horas que restan capacidad).
  const eventHours = new Map<string, number>(); // `${userId}|${day}` → horas
  for (const e of events) {
    const k = `${e.userId}|${dayKey(atMidnightUTC(e.date))}`;
    eventHours.set(k, (eventHours.get(k) ?? 0) + e.hours);
  }

  const result = people.map((p) => {
    const week = byPerson.get(p.id) ?? emptyWeek();
    const dailyHours = p.dailyHours || 8;
    let capacityTotal = 0;
    let assignedTotal = 0;
    let meetingsTotal = 0;
    const byDay = days.map((d) => {
      const k = dayKey(d);
      const workDay = isWorkDay(d);
      const evs = eventHours.get(`${p.id}|${k}`) ?? 0;
      const cap = workDay ? Math.max(0, dailyHours - evs) : 0;
      const asg = week[k].assigned;
      capacityTotal += cap;
      meetingsTotal += evs;
      assignedTotal += asg;
      return {
        date: k,
        isWorkDay: workDay,
        isHoliday: holidays.has(k),
        capacityHours: Math.round(cap * 100) / 100,
        meetingHours: Math.round(evs * 100) / 100,
        assignedHours: Math.round(asg * 100) / 100,
        stories: week[k].stories,
      };
    });
    const load = capacityTotal > 0 ? assignedTotal / capacityTotal : assignedTotal > 0 ? Infinity : 0;
    return {
      id: p.id,
      name: p.name,
      jobTitle: p.jobTitle,
      dailyHours,
      capacityHours: Math.round(capacityTotal * 100) / 100,
      meetingHours: Math.round(meetingsTotal * 100) / 100,
      assignedHours: Math.round(assignedTotal * 100) / 100,
      loadPct: Number.isFinite(load) ? Math.round(load * 100) : 999,
      byDay,
    };
  });

  return ok({
    weekStart: dayKey(monday),
    weekEnd: dayKey(sunday),
    workingDays: workingDaysInWeek,
    days: days.map(dayKey),
    people: result,
  });
}
