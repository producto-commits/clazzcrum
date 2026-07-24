import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { hashPassword } from "@/server/auth/password";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { adminUserCreateSchema } from "@/server/validation/admin";
import { writeAudit } from "@/server/audit";

// GET /api/admin/users — equipo de trabajo (todos los usuarios).
export async function GET() {
  const auth = await requirePermission("read", "user");
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    // Equipo interno: excluye usuarios de portal de cliente (viven en cada cliente).
    where: { roles: { none: { role: { key: "client" } } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      isActive: true,
      emailVerifiedAt: true,
      createdAt: true,
      roles: { include: { role: { select: { key: true, name: true } } } },
    },
  });
  return ok(users);
}

// POST /api/admin/users — crea un miembro del equipo.
export async function POST(req: Request) {
  const auth = await requirePermission("create", "user");
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, adminUserCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { firstName, lastName, email, password, roleKey, jobTitle } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("Ya existe una cuenta con este correo", 409);

  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) return fail("Rol inválido", 400);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: `${firstName} ${lastName}`.trim(),
      email,
      passwordHash,
      jobTitle: jobTitle || null,
      // Cuentas creadas por el admin quedan verificadas (pueden iniciar sesión).
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: role.id } },
    },
  });

  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "user",
    resourceId: user.id,
    metadata: { roleKey },
    ip: clientIp(req),
  });
  return ok({ id: user.id }, { status: 201 });
}
