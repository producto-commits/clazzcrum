import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { resolveTicketWhere, computeSlaDueDates } from "@/server/services/tickets";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { ticketCreateSchema } from "@/server/validation/servicedesk";
import { writeAudit } from "@/server/audit";

// GET /api/tickets?status=&priority=&categoryId=&assigneeId=&q=
export async function GET(req: Request) {
  const auth = await requirePermission("read", "ticket");
  if (auth instanceof NextResponse) return auth;

  const where = await resolveTicketWhere(auth.session);
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  if (status) where.status = status as Prisma.TicketWhereInput["status"];
  const priority = sp.get("priority");
  if (priority) where.priority = priority as Prisma.TicketWhereInput["priority"];
  const categoryId = sp.get("categoryId");
  if (categoryId) where.categoryId = categoryId;
  const assigneeId = sp.get("assigneeId");
  if (assigneeId) where.assigneeId = assigneeId;
  const q = sp.get("q");
  if (q) where.subject = { contains: q, mode: "insensitive" };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });
  return ok(tickets);
}

// POST /api/tickets — crea un caso de soporte.
export async function POST(req: Request) {
  const auth = await requirePermission("create", "ticket");
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, ticketCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Resolver el cliente: el rol cliente reporta sobre su propio cliente.
  const scope = await resolveScope(auth.session);
  let clientId = parsed.data.clientId ?? null;
  if (!scope.isStaff) {
    if (!scope.clientId || scope.clientId === "__none__") {
      return fail("Tu usuario no está vinculado a un cliente", 400);
    }
    clientId = scope.clientId;
  }
  if (!clientId) return fail("Selecciona un cliente", 400);

  const priority = parsed.data.priority ?? "MEDIUM";
  const sla = await computeSlaDueDates(priority);

  // Auto-asignación: buscar el desarrollador (o líder técnico) con mayor
  // dedicación a algún proyecto activo de este cliente. Así el ticket cae
  // directo en la bandeja de quien conoce el proyecto.
  const candidates = await prisma.projectAssignment.findMany({
    where: {
      project: { clientId, status: { in: ["PLANNING", "ACTIVE"] } },
      user: { isActive: true, roles: { some: { role: { key: { in: ["developer", "tech_lead"] } } } } },
    },
    orderBy: [{ dedicationPct: "desc" }, { priority: "asc" }],
    select: { userId: true },
    take: 1,
  });
  const autoAssignee = candidates[0]?.userId ?? null;

  const ticket = await prisma.ticket.create({
    data: {
      clientId,
      reporterId: auth.session.userId,
      subject: parsed.data.subject,
      description: parsed.data.description,
      priority,
      categoryId: parsed.data.categoryId || null,
      assigneeId: autoAssignee,
      status: autoAssignee ? "ASSIGNED" : "NEW",
      ...sla,
    },
  });
  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "ticket",
    resourceId: ticket.id,
    ip: clientIp(req),
  });
  return ok(ticket, { status: 201 });
}
