import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { projectUpdateSchema } from "@/server/validation/scrum";
import { replanSafe } from "@/server/services/planning";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "project");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      epics: { orderBy: { createdAt: "asc" } },
      sprints: { orderBy: { startDate: "asc" } },
      _count: { select: { stories: true } },
    },
  });
  if (!project) return fail("Proyecto no encontrado", 404);

  const scope = await resolveScope(auth.session);
  if (scope.clientId && project.clientId !== scope.clientId) {
    return fail("Proyecto no encontrado", 404);
  }
  if (scope.projectIds && !scope.projectIds.includes(project.id)) {
    return fail("Proyecto no encontrado", 404);
  }
  return ok(project);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "project");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, projectUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const project = await prisma.project.update({ where: { id }, data: parsed.data });
  await replanSafe(id); // fechas/duración de sprint afectan el cronograma
  await writeAudit({
    userId: auth.session.userId,
    action: "update",
    resource: "project",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok(project);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "project");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "project",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
