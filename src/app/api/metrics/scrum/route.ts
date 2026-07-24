import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { sprintVelocity, storyStatusBreakdown, sprintBurndown } from "@/server/services/metrics";
import { ok, fail } from "@/server/http";

// GET /api/metrics/scrum?projectId=&sprintId=
export async function GET(req: Request) {
  const auth = await requirePermission("read", "story");
  if (auth instanceof NextResponse) return auth;
  const sp = new URL(req.url).searchParams;
  const projectId = sp.get("projectId");
  if (!projectId) return fail("projectId requerido", 400);

  // Aislamiento: el cliente solo ve métricas de sus proyectos.
  const scope = await resolveScope(auth.session);
  if (scope.clientId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });
    if (!project || project.clientId !== scope.clientId) return fail("No encontrado", 404);
    if (scope.projectIds && !scope.projectIds.includes(projectId)) return fail("No encontrado", 404);
  }

  const [velocity, statusBreakdown] = await Promise.all([
    sprintVelocity(projectId),
    storyStatusBreakdown(projectId),
  ]);

  // Burndown del sprint indicado, o del último si no se especifica.
  let sprintId = sp.get("sprintId");
  if (!sprintId) {
    const last = await prisma.sprint.findFirst({
      where: { projectId },
      orderBy: { startDate: "desc" },
      select: { id: true },
    });
    sprintId = last?.id ?? null;
  }
  const burndown = sprintId ? await sprintBurndown(sprintId) : null;

  return ok({ velocity, statusBreakdown, burndown, sprintId });
}
