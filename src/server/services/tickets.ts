import { prisma } from "@/server/db";
import type { Prisma, Priority } from "@prisma/client";
import type { SessionPayload } from "@/server/auth/jwt";
import { resolveScope } from "@/server/auth/scope";

// Calcula las fechas objetivo de SLA (primera respuesta y resolución) según la
// política de la prioridad. Devuelve null si no hay política configurada.
export async function computeSlaDueDates(priority: Priority, from: Date = new Date()) {
  const policy = await prisma.sLAPolicy.findUnique({ where: { priority } });
  if (!policy) return { slaPolicyId: null, firstResponseDueAt: null, resolutionDueAt: null };
  return {
    slaPolicyId: policy.id,
    firstResponseDueAt: new Date(from.getTime() + policy.firstResponseMins * 60_000),
    resolutionDueAt: new Date(from.getTime() + policy.resolutionMins * 60_000),
  };
}

// Filtro de tickets visibles según rol:
//  - admin / tech_lead: todos
//  - developer: los asignados a él
//  - client: los de su propio cliente
export async function resolveTicketWhere(
  session: SessionPayload,
): Promise<Prisma.TicketWhereInput> {
  if (session.roles.includes("admin") || session.roles.includes("tech_lead")) {
    return {};
  }
  if (session.roles.includes("developer")) {
    return { assigneeId: session.userId };
  }
  const scope = await resolveScope(session);
  return { clientId: scope.clientId ?? "__none__" };
}
