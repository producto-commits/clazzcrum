import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { epicCreateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";

// GET /api/epics?projectId=... — épicas de un proyecto.
export async function GET(req: Request) {
  const auth = await requirePermission("read", "epic");
  if (auth instanceof NextResponse) return auth;
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return fail("projectId requerido", 400);

  const epics = await prisma.epic.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { stories: true } } },
  });
  return ok(epics);
}

// POST /api/epics — crea una épica.
export async function POST(req: Request) {
  const auth = await requirePermission("create", "epic");
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, epicCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const epic = await prisma.epic.create({
    data: { ...parsed.data, createdById: auth.session.userId },
  });
  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "epic",
    resourceId: epic.id,
    ip: clientIp(req),
  });
  return ok(epic, { status: 201 });
}
