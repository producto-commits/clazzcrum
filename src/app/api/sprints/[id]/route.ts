import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, clientIp } from "@/server/http";
import { sprintUpdateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "sprint");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, sprintUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  // startDate/endDate son nullable en el schema de entrada (opcionales); en el
  // modelo son NOT NULL. Filtramos null y solo enviamos los campos con valor real.
  const { startDate, endDate, ...rest } = parsed.data;
  const data: typeof rest & { startDate?: Date; endDate?: Date } = { ...rest };
  if (startDate) data.startDate = startDate;
  if (endDate) data.endDate = endDate;
  const sprint = await prisma.sprint.update({ where: { id }, data });
  await writeAudit({
    userId: auth.session.userId,
    action: "update",
    resource: "sprint",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok(sprint);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "sprint");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.sprint.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "sprint",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
