import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { ok, fail } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

const storySelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  estimateHours: true,
  estimatedEnd: true,
  startDate: true,
  blockReason: true,
  blockedDays: true,
  actualEnd: true,
  epicId: true,
  assignees: { include: { user: { select: { id: true, name: true } } } },
  _count: { select: { tasks: true, comments: true, acceptanceCriteria: true } },
} satisfies Prisma.UserStorySelect;

// GET /api/projects/[id]/structure — jerarquía anidada Sprint ▸ Épica ▸ Historia.
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "story");
  if (auth instanceof NextResponse) return auth;
  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });
  if (!project) return fail("Proyecto no encontrado", 404);

  const scope = await resolveScope(auth.session);
  if (scope.clientId) {
    if (project.clientId !== scope.clientId) return fail("No encontrado", 404);
    if (scope.projectIds && !scope.projectIds.includes(projectId)) return fail("No encontrado", 404);
  }

  const [sprints, epics, stories] = await Promise.all([
    prisma.sprint.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { startDate: "asc" }],
      select: {
        id: true, projectId: true, name: true, goal: true, startDate: true,
        endDate: true, capacity: true, order: true, createdAt: true,
        createdById: true, ownerId: true,
      },
    }),
    prisma.epic.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, projectId: true, sprintId: true, title: true, description: true,
        priority: true, status: true, order: true, createdAt: true, updatedAt: true,
        createdById: true, ownerId: true,
      },
    }),
    prisma.userStory.findMany({
      where: {
        projectId,
        ...(scope.assignedOnly ? { assignees: { some: { userId: scope.userId } } } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: storySelect,
    }),
  ]);

  const storiesByEpic = new Map<string, typeof stories>();
  const looseStories: typeof stories = [];
  for (const s of stories) {
    if (s.epicId) {
      const arr = storiesByEpic.get(s.epicId) ?? [];
      arr.push(s);
      storiesByEpic.set(s.epicId, arr);
    } else {
      looseStories.push(s);
    }
  }

  const epicsWithStories = epics.map((e) => ({
    ...e,
    stories: storiesByEpic.get(e.id) ?? [],
  }));
  const epicsBySprint = new Map<string, typeof epicsWithStories>();
  const looseEpics: typeof epicsWithStories = [];
  for (const e of epicsWithStories) {
    if (e.sprintId) {
      const arr = epicsBySprint.get(e.sprintId) ?? [];
      arr.push(e);
      epicsBySprint.set(e.sprintId, arr);
    } else {
      looseEpics.push(e);
    }
  }

  // Sprints ▸ epics ▸ stories, después de filtrar historias.
  let sprintsOut = sprints.map((sp) => ({ ...sp, epics: epicsBySprint.get(sp.id) ?? [] }));
  let looseEpicsOut = looseEpics;

  // Para el desarrollador (assignedOnly): oculta épicas y sprints en los que
  // no tenga participación real. Se considera "suyo" un elemento si:
  //   · tiene actividades asignadas a él, o
  //   · él es el encargado (ownerId), o
  //   · él lo creó (createdById).
  // Así, todo hito/fase que se crea en un proyecto asignado al dev queda
  // visible para él aunque aún no haya actividades adentro.
  if (scope.assignedOnly) {
    const uid = scope.userId;
    const isMine = (e: { ownerId: string | null; createdById: string | null; stories: unknown[] }) =>
      e.stories.length > 0 || e.ownerId === uid || e.createdById === uid;
    sprintsOut = sprintsOut
      .map((sp) => ({ ...sp, epics: sp.epics.filter(isMine) }))
      .filter((sp) => sp.epics.length > 0 || sp.ownerId === uid || sp.createdById === uid);
    looseEpicsOut = looseEpicsOut.filter(isMine);
  }

  return ok({
    sprints: sprintsOut,
    looseEpics: looseEpicsOut,
    looseStories,
  });
}
