import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { hashPassword } from "@/server/auth/password";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { adminUserCreateSchema } from "@/server/validation/admin";
import { writeAudit } from "@/server/audit";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

// Para el equipo del cliente el rol siempre es "client"; no se pide en el form.
const memberSchema = adminUserCreateSchema.omit({ roleKey: true }).extend({
  roleKey: z.literal("client").optional(),
  // Proyectos que puede ver (vacío = todos los del cliente).
  projectIds: z.array(z.string()).optional(),
});

// POST /api/clients/[id]/members — crea un usuario del equipo del cliente.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePermission("create", "user");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, memberSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { firstName, lastName, email, password, jobTitle, projectIds } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return fail("Cliente no encontrado", 404);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("Ya existe una cuenta con este correo", 409);

  const clientRole = await prisma.role.findUnique({ where: { key: "client" } });
  if (!clientRole) return fail("Rol cliente no configurado", 500);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: `${firstName} ${lastName}`.trim(),
      email,
      passwordHash,
      jobTitle: jobTitle || null,
      clientId: id,
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: clientRole.id } },
      projectAccess: projectIds?.length
        ? { create: projectIds.map((projectId) => ({ projectId })) }
        : undefined,
    },
  });

  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "user",
    resourceId: user.id,
    metadata: { clientId: id, portal: true },
    ip: clientIp(req),
  });
  return ok({ id: user.id }, { status: 201 });
}
