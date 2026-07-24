import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/portal";
import { ok, fail } from "@/server/http";

// GET /api/daily — vista del daily para el LÍDER: avances de ayer,
// trabajo en curso y bloqueos, agrupables por desarrollador.
export async function GET() {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  if (auth.scope.assignedOnly) return fail("Solo para líderes y administradores", 403);

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today.getTime() - 86400000);

  const sel = {
    id: true,
    title: true,
    status: true,
    estimateHours: true,
    blockReason: true,
    blockedAt: true,
    blockedDays: true,
    actualEnd: true,
    estimatedEnd: true,
    project: { select: { id: true, name: true } },
    assignees: { select: { user: { select: { id: true, name: true } } } },
  };

  const [completedYesterday, inProgress, blocked, ticketsResolved, projects] = await Promise.all([
    prisma.userStory.findMany({
      where: { status: "DONE", actualEnd: { gte: yesterday, lt: today } },
      select: sel,
    }),
    prisma.userStory.findMany({ where: { status: "IN_PROGRESS" }, select: sel, take: 100 }),
    prisma.userStory.findMany({ where: { status: "BLOCKED" }, select: sel, take: 100 }),
    prisma.ticket.findMany({
      where: { resolvedAt: { gte: yesterday, lt: today } },
      select: { id: true, number: true, subject: true, assignee: { select: { id: true, name: true } } },
    }),
    prisma.project.findMany({
      where: { status: { in: ["PLANNING", "ACTIVE"] } },
      select: {
        id: true,
        name: true,
        plannedEndAt: true,
        stories: { select: { status: true } },
      },
      take: 30,
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

  return ok({
    date: yesterday.toISOString(),
    completedYesterday,
    inProgress,
    blocked,
    ticketsResolved,
    projects: projectSummary,
  });
}
