import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/portal";
import { ok } from "@/server/http";

// GET /api/alerts — campana: actividades que vencen HOY, vencidas y tickets nuevos.
// Developer ve lo suyo; admin/líder ven todo.
export async function GET() {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  const { scope } = auth;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today.getTime() + 86400000);

  const base: Prisma.UserStoryWhereInput = {
    status: { not: "DONE" },
    ...(scope.assignedOnly ? { assignees: { some: { userId: scope.userId } } } : {}),
  };
  const sel = {
    id: true,
    title: true,
    estimatedEnd: true,
    projectId: true,
    project: { select: { name: true } },
  } satisfies Prisma.UserStorySelect;

  const [dueToday, overdue, newTickets] = await Promise.all([
    prisma.userStory.findMany({
      where: { ...base, estimatedEnd: { gte: today, lt: tomorrow } },
      select: sel,
      take: 20,
    }),
    prisma.userStory.findMany({
      where: { ...base, estimatedEnd: { lt: today } },
      select: sel,
      orderBy: { estimatedEnd: "asc" },
      take: 20,
    }),
    prisma.ticket.findMany({
      where: {
        status: "NEW",
        ...(scope.assignedOnly ? { assigneeId: scope.userId } : {}),
      },
      select: { id: true, number: true, subject: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return ok({ dueToday, overdue, newTickets });
}
