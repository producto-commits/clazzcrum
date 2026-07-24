import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { hashPassword } from "@/server/auth/password";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { adminUserUpdateSchema } from "@/server/validation/admin";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id] — edita nombre, cargo, rol, estado o contraseña.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "user");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, adminUserUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { name, email, jobTitle, roleKey, isActive, password, projectIds } = parsed.data;

  const data: Prisma.UserUpdateInput = {};
  if (name !== undefined) data.name = name;
  if (jobTitle !== undefined) data.jobTitle = jobTitle || null;
  if (isActive !== undefined) data.isActive = isActive;
  if (password) data.passwordHash = await hashPassword(password);
  if (email !== undefined) {
    const clash = await prisma.user.findFirst({ where: { email, id: { not: id } } });
    if (clash) return fail("Ya existe otra cuenta con este correo", 409);
    data.email = email;
  }

  // Cambiar de rol: se reemplaza el conjunto de roles por el elegido.
  if (roleKey) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) return fail("Rol inválido", 400);
    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.userRole.create({ data: { userId: id, roleId: role.id } });
  }

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id }, data });
  }

  // Acceso por proyecto (usuarios de cliente): reemplaza el conjunto.
  if (projectIds) {
    await prisma.userProjectAccess.deleteMany({ where: { userId: id } });
    if (projectIds.length) {
      await prisma.userProjectAccess.createMany({
        data: projectIds.map((projectId) => ({ userId: id, projectId })),
        skipDuplicates: true,
      });
    }
  }

  await writeAudit({
    userId: auth.session.userId,
    action: "update",
    resource: "user",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
