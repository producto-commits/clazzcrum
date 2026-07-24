import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { clientUpdateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "client");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: true,
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          isActive: true,
          projectAccess: { select: { projectId: true } },
        },
      },
      _count: { select: { tickets: true } },
    },
  });
  if (!client) return fail("Cliente no encontrado", 404);
  return ok(client);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "client");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, clientUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const data = { ...parsed.data };
  if (data.email === "") data.email = null;

  const client = await prisma.client.update({ where: { id }, data });
  await writeAudit({
    userId: auth.session.userId,
    action: "update",
    resource: "client",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok(client);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "client");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.client.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "client",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
