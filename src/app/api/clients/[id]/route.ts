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
      parent: { select: { id: true, name: true } },
      children: {
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, contactName: true, email: true, phone: true,
          _count: { select: { projects: true, tickets: true, children: true } },
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

  // Anti-ciclo: si se cambia el padre, verificar que el nuevo padre no sea
  // el propio cliente ni uno de sus descendientes.
  if (data.parentId !== undefined) {
    if (data.parentId === id) {
      return fail("Un cliente no puede ser subcliente de sí mismo.", 422);
    }
    if (data.parentId) {
      // Subir por la cadena de padres del nuevo parentId. Si toca a `id`,
      // habría ciclo.
      let cursor: string | null = data.parentId;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        if (cursor === id) {
          return fail("El nuevo padre depende de este cliente (ciclo).", 422);
        }
        seen.add(cursor);
        const nextParent: { parentId: string | null } | null = await prisma.client.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = nextParent?.parentId ?? null;
      }
    } else {
      data.parentId = null;
    }
  }

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
  const toDelete = await prisma.client.findUnique({
    where: { id },
    select: { name: true, _count: { select: { projects: true, tickets: true, members: true } } },
  });
  if (!toDelete) return fail("Cliente no encontrado", 404);
  await prisma.client.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "client",
    resourceId: id,
    metadata: {
      name: toDelete.name,
      projectsDeleted: toDelete._count.projects,
      ticketsDeleted: toDelete._count.tickets,
      membersUnlinked: toDelete._count.members,
    },
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
