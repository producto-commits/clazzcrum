import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { resolveScope } from "@/server/auth/scope";
import { parseBody, ok, fail } from "@/server/http";
import { csatSchema } from "@/server/validation/servicedesk";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/tickets/[id]/csat — el cliente califica la atención (1-5) al resolverse.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "ticket");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, csatSchema);
  if (parsed instanceof NextResponse) return parsed;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return fail("Caso no encontrado", 404);

  const scope = await resolveScope(auth.session);
  if (!scope.isStaff && scope.clientId !== ticket.clientId) {
    return fail("Caso no encontrado", 404);
  }
  if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
    return fail("Solo puedes calificar casos resueltos", 400);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { csatScore: parsed.data.score },
  });
  return ok(updated);
}
