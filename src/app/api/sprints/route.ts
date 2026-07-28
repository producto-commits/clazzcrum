import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { sprintCreateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";

// GET /api/sprints?projectId=... — sprints de un proyecto.
export async function GET(req: Request) {
  const auth = await requirePermission("read", "sprint");
  if (auth instanceof NextResponse) return auth;
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return fail("projectId requerido", 400);

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { startDate: "asc" },
    include: { _count: { select: { stories: true } } },
  });
  return ok(sprints);
}

// POST /api/sprints — crea un sprint.
export async function POST(req: Request) {
  const auth = await requirePermission("create", "sprint");
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, sprintCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Si el usuario no envió fechas, las calculamos: startDate = inicio del proyecto
  // (o hoy si no lo tiene) y endDate = startDate + 4 semanas. El motor de
  // planificación las reajustará según el trabajo real que caiga en el hito.
  const proj = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { startDate: true },
  });
  const start = parsed.data.startDate ?? proj?.startDate ?? new Date();
  const end =
    parsed.data.endDate ??
    new Date(start.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
  if (end < start) {
    return fail("La fecha de fin no puede ser anterior al inicio", 422);
  }

  // Consecutivo automático SP-01, SP-02… por proyecto. El usuario solo escribe
  // el nombre descriptivo; el código lo asigna el sistema (máximo existente + 1),
  // así no se repite aunque se borren sprints intermedios.
  const existing = await prisma.sprint.findMany({
    where: { projectId: parsed.data.projectId },
    select: { name: true },
  });
  let maxN = 0;
  for (const s of existing) {
    const m = s.name.match(/(?:SP|H)-(\d+)/i);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  const code = `H-${String(maxN + 1).padStart(2, "0")}`;
  // Quita cualquier prefijo "SP-XX ·" que el usuario haya escrito por costumbre.
  const cleanName = parsed.data.name.replace(/^\s*(?:SP|H)-\d+\s*[·:.-]?\s*/i, "").trim();
  const name = cleanName ? `${code} · ${cleanName}` : code;

  const sprint = await prisma.sprint.create({
    data: { ...parsed.data, name, startDate: start, endDate: end },
  });
  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "sprint",
    resourceId: sprint.id,
    ip: clientIp(req),
  });
  return ok(sprint, { status: 201 });
}
