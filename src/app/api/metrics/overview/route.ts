import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { resolveTicketWhere } from "@/server/services/tickets";
import { serviceDeskMetrics } from "@/server/services/metrics";
import { ok } from "@/server/http";

// GET /api/metrics/overview — tarjetas del panel principal (según rol).
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const scope = await resolveScope(auth.session);
  let projectWhere: Prisma.ProjectWhereInput = {};
  if (scope.clientId) {
    projectWhere = { clientId: scope.clientId, ...(scope.projectIds ? { id: { in: scope.projectIds } } : {}) };
  } else if (scope.assignedOnly) {
    projectWhere = { stories: { some: { assignees: { some: { userId: scope.userId } } } } };
  }

  const storyWhere: Prisma.UserStoryWhereInput = { project: projectWhere };
  if (scope.assignedOnly) storyWhere.assignees = { some: { userId: scope.userId } };

  const [projectsTotal, projectsActive, storyRows, ticketWhere] = await Promise.all([
    prisma.project.count({ where: projectWhere }),
    prisma.project.count({ where: { ...projectWhere, status: "ACTIVE" } }),
    prisma.userStory.groupBy({
      by: ["status"],
      where: storyWhere,
      _count: { _all: true },
    }),
    resolveTicketWhere(auth.session),
  ]);

  const storiesByStatus: Record<string, number> = {};
  let storiesTotal = 0;
  for (const r of storyRows) {
    storiesByStatus[r.status] = r._count._all;
    storiesTotal += r._count._all;
  }

  const sd = await serviceDeskMetrics(ticketWhere);

  return ok({
    isStaff: scope.isStaff,
    projects: { total: projectsTotal, active: projectsActive },
    stories: {
      total: storiesTotal,
      done: storiesByStatus["DONE"] ?? 0,
      inProgress: storiesByStatus["IN_PROGRESS"] ?? 0,
      blocked: storiesByStatus["BLOCKED"] ?? 0,
      byStatus: storiesByStatus,
    },
    serviceDesk: sd,
  });
}
