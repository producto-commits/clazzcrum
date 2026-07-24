import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/portal";
import { ok, fail } from "@/server/http";
import { replanForUser } from "@/server/services/planning";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/meetings/[id] — cancela la reunión: libera la capacidad y
// REPLANIFICA los proyectos de quienes asistían.
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { attendees: { select: { userId: true } } },
  });
  if (!meeting) return fail("Reunión no encontrada", 404);
  const userIds = meeting.attendees.map((a) => a.userId);

  await prisma.capacityEvent.deleteMany({ where: { source: "meeting", refId: id } });
  await prisma.meeting.delete({ where: { id } });

  for (const userId of userIds) await replanForUser(userId);
  return ok({ ok: true });
}
