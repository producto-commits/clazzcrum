import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok } from "@/server/http";
import { criterionUpdateSchema } from "@/server/validation/scrum";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "story");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, criterionUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const criterion = await prisma.acceptanceCriterion.update({
    where: { id },
    data: parsed.data,
  });
  return ok(criterion);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "story");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.acceptanceCriterion.delete({ where: { id } });
  return ok({ ok: true });
}
