import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { writeAudit } from "@/server/audit";
import { replanSafe } from "@/server/services/planning";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/assignments — equipo asignado al proyecto (con % y prioridad).
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "project");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: id },
    orderBy: [{ dedicationPct: "desc" }, { priority: "asc" }],
    select: {
      userId: true,
      dedicationPct: true,
      priority: true,
      user: {
        select: {
          id: true, name: true, email: true, jobTitle: true, isActive: true,
          roles: { select: { role: { select: { key: true, name: true } } } },
        },
      },
    },
  });
  return ok(assignments);
}

const putSchema = z.object({
  assignments: z
    .array(
      z.object({
        userId: z.string().min(1),
        dedicationPct: z.coerce.number().int().min(1).max(100),
        priority: z.coerce.number().int().min(1).max(99).optional(),
      }),
    )
    .max(30),
});

// POST /api/projects/[id]/assignments — reemplaza el equipo asignado al proyecto.
// Se controla desde la vista del proyecto en vez de tener que editar a cada persona.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "project");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, putSchema);
  if (parsed instanceof NextResponse) return parsed;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return fail("Proyecto no encontrado", 404);

  // Validar que cada userId sea un usuario staff activo. Evita asignar
  // clientes o cuentas inactivas al equipo del proyecto.
  const userIds = parsed.data.assignments.map((a) => a.userId);
  const validUsers = userIds.length
    ? await prisma.user.findMany({
        where: {
          id: { in: userIds },
          isActive: true,
          roles: { some: { role: { key: { in: ["developer", "tech_lead", "admin"] } } } },
        },
        select: { id: true },
      })
    : [];
  const validSet = new Set(validUsers.map((u) => u.id));
  const clean = parsed.data.assignments.filter((a) => validSet.has(a.userId));

  // Antes/después para saber a qué usuarios avisar y replanificar.
  const previous = await prisma.projectAssignment.findMany({
    where: { projectId: id },
    select: { userId: true },
  });
  const prevIds = new Set(previous.map((p) => p.userId));

  await prisma.$transaction([
    prisma.projectAssignment.deleteMany({ where: { projectId: id } }),
    ...(clean.length
      ? [
          prisma.projectAssignment.createMany({
            data: clean.map((a) => ({
              projectId: id,
              userId: a.userId,
              dedicationPct: a.dedicationPct,
              priority: a.priority ?? 1,
            })),
          }),
        ]
      : []),
  ]);

  await writeAudit({
    userId: auth.session.userId,
    action: "update",
    resource: "project",
    resourceId: id,
    metadata: { assignments: clean.length, prev: prevIds.size },
    ip: clientIp(req),
  });

  // Recalcular cronograma del proyecto con las nuevas capacidades.
  await replanSafe(id);
  return ok({ ok: true, applied: clean.length });
}
