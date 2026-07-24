import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, clientIp } from "@/server/http";
import { epicUpdateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "epic");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, epicUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const epic = await prisma.epic.update({ where: { id }, data: parsed.data });
  await writeAudit({
    userId: auth.session.userId,
    action: "update",
    resource: "epic",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok(epic);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "epic");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.epic.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "epic",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
