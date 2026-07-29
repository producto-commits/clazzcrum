import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { clientCreateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";

// GET /api/clients — lista de clientes.
export async function GET() {
  const auth = await requirePermission("read", "client");
  if (auth instanceof NextResponse) return auth;

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true, tickets: true, children: true } },
      parent: { select: { id: true, name: true } },
    },
  });
  return ok(clients);
}

// POST /api/clients — crea un cliente.
export async function POST(req: Request) {
  const auth = await requirePermission("create", "client");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, clientCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { email, parentId, ...rest } = parsed.data;

  // Validar que el padre exista (si viene).
  if (parentId) {
    const parent = await prisma.client.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!parent) return fail("El cliente padre no existe", 422);
  }

  const client = await prisma.client.create({
    data: { ...rest, email: email || null, parentId: parentId || null },
  });
  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "client",
    resourceId: client.id,
    ip: clientIp(req),
  });
  return ok(client, { status: 201 });
}
