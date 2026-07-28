import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { hashPassword } from "@/server/auth/password";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { adminUserUpdateSchema } from "@/server/validation/admin";
import { writeAudit } from "@/server/audit";
import { replanForUser } from "@/server/services/planning";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id] — edita nombre, cargo, rol, estado o contraseña.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "user");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, adminUserUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { name, email, jobTitle, roleKey, isActive, password, projectIds, dailyHours, weeklyHours, assignments } = parsed.data;

  const data: Prisma.UserUpdateInput = {};
  if (name !== undefined) data.name = name;
  if (jobTitle !== undefined) data.jobTitle = jobTitle || null;
  if (isActive !== undefined) data.isActive = isActive;
  if (dailyHours !== undefined) data.dailyHours = dailyHours;
  if (weeklyHours !== undefined) data.weeklyHours = weeklyHours;
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

  // Dedicación por proyecto (motor de planificación): reemplaza el conjunto.
  if (assignments) {
    const total = assignments.reduce((s, a) => s + a.dedicationPct, 0);
    if (total > 100) return fail(`La dedicación suma ${total}%; el máximo es 100%`, 422);
    await prisma.projectAssignment.deleteMany({ where: { userId: id } });
    if (assignments.length) {
      await prisma.projectAssignment.createMany({
        data: assignments.map((a) => ({
          userId: id,
          projectId: a.projectId,
          dedicationPct: a.dedicationPct,
          priority: a.priority ?? 1,
        })),
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
  // La capacidad o dedicación cambió → recalcular cronogramas del desarrollador.
  if (assignments || dailyHours !== undefined) await replanForUser(id);
  return ok({ ok: true });
}

// DELETE /api/admin/users/[id] — elimina un usuario (miembro del equipo o
// contacto del cliente). Requiere permiso `delete:user` (admin).
// La FK de sesiones/rols/assignments cae por cascada.
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "user");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  // Evita auto-eliminarse.
  if (id === auth.session.userId) {
    return fail("No puedes eliminar tu propio usuario.", 400);
  }
  const target = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true, clientId: true, roles: { select: { role: { select: { key: true, name: true } } } } },
  });
  if (!target) return fail("Usuario no encontrado", 404);

  await prisma.user.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "user",
    resourceId: id,
    metadata: {
      name: target.name,
      email: target.email,
      clientId: target.clientId ?? null,
      roles: target.roles.map((r) => r.role.key),
    },
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
