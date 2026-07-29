import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { parseBody, ok, clientIp } from "@/server/http";
import { projectCreateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";

// GET /api/projects — proyectos visibles según el rol (cliente = solo los suyos).
export async function GET() {
  const auth = await requirePermission("read", "project");
  if (auth instanceof NextResponse) return auth;

  const scope = await resolveScope(auth.session);
  let where: Prisma.ProjectWhereInput | undefined;
  if (scope.clientId) {
    where = { clientId: scope.clientId, ...(scope.projectIds ? { id: { in: scope.projectIds } } : {}) };
  } else if (scope.assignedOnly) {
    // Desarrollador: proyectos donde tenga alguna relación real —
    // dedicación asignada, actividad asignada, o algún ticket asignado.
    where = {
      OR: [
        { assignments: { some: { userId: scope.userId } } },
        { stories: { some: { assignees: { some: { userId: scope.userId } } } } },
        { client: { tickets: { some: { assigneeId: scope.userId } } } },
      ],
    };
  }
  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      // Equipo asignado: quién trabaja aquí, con su % de dedicación.
      // Se muestra en el listado como chip por persona, con el dueño
      // (mayor dedicación) resaltado.
      assignments: {
        orderBy: [{ dedicationPct: "desc" }, { priority: "asc" }],
        select: {
          userId: true,
          dedicationPct: true,
          priority: true,
          user: { select: { id: true, name: true, jobTitle: true } },
        },
      },
      _count: { select: { stories: true, sprints: true, epics: true } },
    },
  });
  return ok(projects);
}

// POST /api/projects — crea un proyecto.
export async function POST(req: Request) {
  const auth = await requirePermission("create", "project");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, projectCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const project = await prisma.project.create({ data: parsed.data });
  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "project",
    resourceId: project.id,
    ip: clientIp(req),
  });
  return ok(project, { status: 201 });
}
