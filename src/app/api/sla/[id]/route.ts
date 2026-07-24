import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, clientIp } from "@/server/http";
import { slaUpdateSchema } from "@/server/validation/servicedesk";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/sla/[id] — el admin ajusta los tiempos objetivo de una prioridad.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "sla");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, slaUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const policy = await prisma.sLAPolicy.update({ where: { id }, data: parsed.data });
  await writeAudit({
    userId: auth.session.userId,
    action: "update",
    resource: "sla",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok(policy);
}
