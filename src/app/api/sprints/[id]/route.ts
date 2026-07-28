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
  const { startDate, endDate, name, ...rest } = parsed.data;
  const data: typeof rest & { startDate?: Date; endDate?: Date; name?: string } = { ...rest };
  if (startDate) data.startDate = startDate;
  if (endDate) data.endDate = endDate;
  // Al renombrar, conservamos el código consecutivo (H-01, SP-02…). Si el
  // usuario ya lo incluyó no lo duplicamos; si escribió solo el título, lo
  // anteponemos con el código actual del hito.
  if (name !== undefined) {
    const current = await prisma.sprint.findUnique({ where: { id }, select: { name: true } });
    const prefix = current?.name.match(/^(?:SP|H)-\d+/i)?.[0];
    const cleanNew = name.replace(/^\s*(?:SP|H)-\d+\s*[·:.-]?\s*/i, "").trim();
    data.name = prefix ? (cleanNew ? `${prefix} · ${cleanNew}` : prefix) : name;
  }
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
  const toDelete = await prisma.sprint.findUnique({
    where: { id },
    select: { name: true, projectId: true, project: { select: { name: true } } },
  });
  await prisma.sprint.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "sprint",
    resourceId: id,
    metadata: {
      name: toDelete?.name ?? null,
      projectId: toDelete?.projectId ?? null,
      projectName: toDelete?.project?.name ?? null,
    },
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
