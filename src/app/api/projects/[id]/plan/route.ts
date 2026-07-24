import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { ok, fail } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/plan — cronograma calculado: sprints automáticos
// con sus actividades y los hitos que caen en cada uno.
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "project");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, startDate: true, plannedEndAt: true, sprintWeeks: true, createdAt: true },
  });
  if (!project) return fail("Proyecto no encontrado", 404);

  const sprints = await prisma.planSprint.findMany({
    where: { projectId: id },
    orderBy: { index: "asc" },
    include: {
      stories: {
        select: {
          id: true,
          title: true,
          status: true,
          estimateHours: true,
          startDate: true,
          estimatedEnd: true,
          assignees: { select: { user: { select: { id: true, name: true } } } },
          epic: { select: { title: true, sprint: { select: { id: true, name: true } } } },
        },
        orderBy: { startDate: "asc" },
      },
    },
  });

  // Hitos que entran en cada sprint (derivados de las actividades).
  const enriched = sprints.map((sp) => {
    const hitos = new Map<string, { name: string; count: number; hours: number }>();
    for (const st of sp.stories) {
      const h = st.epic?.sprint;
      const key = h?.id ?? "__sin_hito__";
      const cur = hitos.get(key) ?? { name: h?.name ?? "Sin hito", count: 0, hours: 0 };
      cur.count++;
      cur.hours += st.estimateHours ?? 0;
      hitos.set(key, cur);
    }
    return { ...sp, hitos: [...hitos.values()] };
  });

  // Actividades sin planificar (sin responsable o sin horas), para avisar.
  const unplanned = await prisma.userStory.count({
    where: {
      projectId: id,
      status: { not: "DONE" },
      OR: [{ assignees: { none: {} } }, { estimateHours: null }, { estimateHours: { lte: 0 } }],
    },
  });

  return ok({ project, sprints: enriched, unplanned });
}
