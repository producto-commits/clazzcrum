import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { storyCreateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";
import { replanSafe } from "@/server/services/planning";

const storyInclude = {
  assignees: { include: { user: { select: { id: true, name: true } } } },
  epic: { select: { id: true, title: true } },
  _count: { select: { tasks: true, comments: true, acceptanceCriteria: true } },
} satisfies Prisma.UserStoryInclude;

// GET /api/stories?projectId=&sprintId=&epicId=&assigneeId=&priority=&tag=&q=
export async function GET(req: Request) {
  const auth = await requirePermission("read", "story");
  if (auth instanceof NextResponse) return auth;

  const sp = new URL(req.url).searchParams;
  const projectId = sp.get("projectId");
  if (!projectId) return fail("projectId requerido", 400);

  const scope = await resolveScope(auth.session);
  if (scope.clientId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });
    if (!project || project.clientId !== scope.clientId) return ok([]);
    if (scope.projectIds && !scope.projectIds.includes(projectId)) return ok([]);
  }

  const where: Prisma.UserStoryWhereInput = { projectId };
  // Desarrollador: solo sus historias asignadas.
  if (scope.assignedOnly) where.assignees = { some: { userId: scope.userId } };
  const sprintId = sp.get("sprintId");
  if (sprintId) where.sprintId = sprintId === "none" ? null : sprintId;
  const epicId = sp.get("epicId");
  if (epicId) where.epicId = epicId === "none" ? null : epicId;
  const priority = sp.get("priority");
  if (priority) where.priority = priority as Prisma.UserStoryWhereInput["priority"];
  const assigneeId = sp.get("assigneeId");
  if (assigneeId) where.assignees = { some: { userId: assigneeId } };
  const tag = sp.get("tag");
  if (tag) where.tags = { has: tag };
  const q = sp.get("q");
  if (q) where.title = { contains: q, mode: "insensitive" };

  const stories = await prisma.userStory.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: storyInclude,
  });
  return ok(stories);
}

// POST /api/stories — crea una historia (con asignados y etiquetas).
export async function POST(req: Request) {
  const auth = await requirePermission("create", "story");
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, storyCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { assigneeIds, ...data } = parsed.data;

  // Jerarquía anidada: si la historia va en una épica, hereda el sprint de la épica.
  if (data.epicId) {
    const epic = await prisma.epic.findUnique({
      where: { id: data.epicId },
      select: { sprintId: true },
    });
    if (epic) data.sprintId = epic.sprintId;
  }

  // Toda historia nueva entra en Backlog salvo que se indique otro estado.
  if (!data.status) data.status = "BACKLOG";

  // Si el creador es desarrollador (no líder/admin), se autoasigna la historia.
  const roles = auth.session.roles;
  const isDeveloper =
    roles.includes("developer") && !roles.includes("admin") && !roles.includes("tech_lead");
  let finalAssignees = assigneeIds ?? [];
  if (isDeveloper && finalAssignees.length === 0) finalAssignees = [auth.session.userId];

  const story = await prisma.userStory.create({
    data: {
      ...data,
      tags: data.tags ?? [],
      assignees: finalAssignees.length
        ? { create: finalAssignees.map((userId) => ({ userId })) }
        : undefined,
    },
    include: storyInclude,
  });
  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "story",
    resourceId: story.id,
    ip: clientIp(req),
  });
  await replanSafe(parsed.data.projectId); // el motor recalcula el cronograma
  return ok(story, { status: 201 });
}
