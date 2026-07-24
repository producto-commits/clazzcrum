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
    include: { _count: { select: { projects: true, tickets: true } } },
  });
  return ok(clients);
}

// POST /api/clients — crea un cliente.
export async function POST(req: Request) {
  const auth = await requirePermission("create", "client");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, clientCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { email, ...rest } = parsed.data;

  const client = await prisma.client.create({
    data: { ...rest, email: email || null },
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
