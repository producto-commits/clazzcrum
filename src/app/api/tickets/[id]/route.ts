import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { computeSlaDueDates } from "@/server/services/tickets";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { ticketUpdateSchema } from "@/server/validation/servicedesk";
import { writeAudit } from "@/server/audit";
import { replanForUser } from "@/server/services/planning";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "ticket");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      reporter: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      slaPolicy: true,
      linkedStory: { select: { id: true, title: true, projectId: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true } } },
      },
      workLogs: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!ticket) return fail("Caso no encontrado", 404);

  // Aislamiento: el cliente solo ve sus casos y solo mensajes públicos.
  const scope = await resolveScope(auth.session);
  if (!scope.isStaff) {
    if (scope.clientId !== ticket.clientId) return fail("Caso no encontrado", 404);
    ticket.messages = ticket.messages.filter((m) => m.visibility === "PUBLIC");
    ticket.workLogs = []; // el tiempo de ejecución es interno del equipo
  }
  return ok(ticket);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "ticket");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, ticketUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const current = await prisma.ticket.findUnique({ where: { id } });
  if (!current) return fail("Caso no encontrado", 404);

  const data: Prisma.TicketUpdateInput = {};
  const p = parsed.data;

  if (p.categoryId !== undefined) {
    data.category = p.categoryId ? { connect: { id: p.categoryId } } : { disconnect: true };
  }
  if (p.assigneeId !== undefined) {
    data.assignee = p.assigneeId ? { connect: { id: p.assigneeId } } : { disconnect: true };
    // Asignar mueve de NEW a ASSIGNED si no se especifica otro estado.
    if (p.assigneeId && !p.status && current.status === "NEW") data.status = "ASSIGNED";
  }
  if (p.priority && p.priority !== current.priority) {
    data.priority = p.priority;
    // Recalcular SLA si aún no se ha resuelto.
    if (!current.resolvedAt) {
      const sla = await computeSlaDueDates(p.priority, current.createdAt);
      data.slaPolicy = sla.slaPolicyId ? { connect: { id: sla.slaPolicyId } } : { disconnect: true };
      data.firstResponseDueAt = sla.firstResponseDueAt;
      data.resolutionDueAt = sla.resolutionDueAt;
    }
  }
  // Momento en que se resuelve, para registrar el tiempo de ejecución.
  const resolvedNow = new Date();
  let logExecution = false;
  if (p.status) {
    data.status = p.status;
    // Primer paso a EN PROCESO marca el inicio de la ejecución.
    if (p.status === "IN_PROGRESS" && !current.inProgressAt) data.inProgressAt = resolvedNow;
    if (p.status === "RESOLVED") {
      // El desarrollador debe indicar CUÁNTAS HORAS le tomó (obligatorio).
      // Sin este valor no se puede cerrar el caso: nada de tiempos automáticos.
      if (current.status !== "RESOLVED") {
        if (p.resolutionHours == null || p.resolutionHours <= 0) {
          return fail(
            "Indica cuántas horas te tomó resolver el caso.",
            422,
            { field: "resolutionHours" },
          );
        }
        logExecution = true;
      }
      data.resolvedAt = resolvedNow;
    }
    if (p.status === "CLOSED") data.closedAt = resolvedNow;
    if (p.status === "REOPENED") {
      data.resolvedAt = null;
      data.closedAt = null;
    }
  }

  const ticket = await prisma.ticket.update({ where: { id }, data });

  // Registrar el tiempo de ejecución (declarado MANUALMENTE por el desarrollador).
  if (logExecution) {
    const hours = p.resolutionHours as number;
    const durationSeconds = Math.round(hours * 3600);
    const startedAt = new Date(resolvedNow.getTime() - durationSeconds * 1000);
    const devId = current.assigneeId ?? auth.session.userId;
    await prisma.ticketWorkLog.create({
      data: {
        ticketId: id,
        userId: devId,
        startedAt,
        endedAt: resolvedNow,
        durationSeconds,
      },
    });
    // El tiempo declarado resta capacidad del día → replanificar sus proyectos.
    const day = new Date(Date.UTC(resolvedNow.getUTCFullYear(), resolvedNow.getUTCMonth(), resolvedNow.getUTCDate()));
    await prisma.capacityEvent.create({
      data: { userId: devId, date: day, hours, source: "ticket", refId: id },
    });
    await replanForUser(devId);
  }
  await writeAudit({
    userId: auth.session.userId,
    action: p.status ? "status_change" : "update",
    resource: "ticket",
    resourceId: id,
    metadata: p.status ? { status: p.status } : undefined,
    ip: clientIp(req),
  });
  return ok(ticket);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "ticket");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.ticket.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "ticket",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
