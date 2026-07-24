import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { ticketMessageSchema } from "@/server/validation/servicedesk";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/tickets/[id]/messages — agrega una respuesta pública o nota interna.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "ticket");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, ticketMessageSchema);
  if (parsed instanceof NextResponse) return parsed;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return fail("Caso no encontrado", 404);

  const scope = await resolveScope(auth.session);
  // El cliente solo puede escribir en su propio caso y siempre en público.
  if (!scope.isStaff && scope.clientId !== ticket.clientId) {
    return fail("Caso no encontrado", 404);
  }
  const visibility = scope.isStaff ? (parsed.data.visibility ?? "PUBLIC") : "PUBLIC";

  const message = await prisma.ticketMessage.create({
    data: { ticketId: id, userId: auth.session.userId, body: parsed.data.body, visibility },
    include: { user: { select: { id: true, name: true } } },
  });

  // Efectos de estado / SLA
  const upd: Prisma.TicketUpdateInput = {};
  if (scope.isStaff && visibility === "PUBLIC") {
    if (!ticket.firstRespondedAt) upd.firstRespondedAt = new Date();
    if (ticket.status === "NEW" || ticket.status === "ASSIGNED") upd.status = "IN_PROGRESS";
  } else if (!scope.isStaff) {
    // El cliente respondió: reabrir si estaba resuelto, o reactivar si esperaba su respuesta.
    if (ticket.status === "RESOLVED") upd.status = "REOPENED";
    else if (ticket.status === "WAITING_CLIENT") upd.status = "IN_PROGRESS";
  }
  if (Object.keys(upd).length) {
    await prisma.ticket.update({ where: { id }, data: upd });
  }

  await writeAudit({
    userId: auth.session.userId,
    action: "reply",
    resource: "ticket",
    resourceId: id,
    metadata: { visibility },
    ip: clientIp(req),
  });
  return ok(message, { status: 201 });
}
