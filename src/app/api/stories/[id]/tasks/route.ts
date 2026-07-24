import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok } from "@/server/http";
import { taskCreateSchema } from "@/server/validation/scrum";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/stories/[id]/tasks — crea una subtarea.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePermission("create", "task");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, taskCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const count = await prisma.task.count({ where: { storyId: id } });
  const task = await prisma.task.create({
    data: { ...parsed.data, storyId: id, order: count },
    include: { assignee: { select: { id: true, name: true } } },
  });
  return ok(task, { status: 201 });
}
