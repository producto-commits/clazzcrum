import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok } from "@/server/http";
import { taskUpdateSchema } from "@/server/validation/scrum";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "task");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, taskUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const task = await prisma.task.update({
    where: { id },
    data: parsed.data,
    include: { assignee: { select: { id: true, name: true } } },
  });
  return ok(task);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "task");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return ok({ ok: true });
}
