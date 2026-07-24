import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok } from "@/server/http";
import { criterionCreateSchema } from "@/server/validation/scrum";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/stories/[id]/criteria — agrega un criterio de aceptación (Definition of Done).
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "story");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, criterionCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const count = await prisma.acceptanceCriterion.count({ where: { storyId: id } });
  const criterion = await prisma.acceptanceCriterion.create({
    data: { storyId: id, text: parsed.data.text, order: count },
  });
  return ok(criterion, { status: 201 });
}
