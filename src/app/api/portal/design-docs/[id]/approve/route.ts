import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePortal, clientCanSeeProject } from "@/server/auth/portal";
import { ok, fail, clientIp } from "@/server/http";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/portal/design-docs/[id]/approve — el cliente aprueba el documento.
// Al aprobar queda BLOQUEADO (no admite más comentarios ni re-aprobación).
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePortal();
  if (auth instanceof NextResponse) return auth;
  const { scope } = auth;
  const { id } = await params;

  const doc = await prisma.designDoc.findUnique({
    where: { id },
    include: { project: { select: { id: true, clientId: true } } },
  });
  if (!doc || !clientCanSeeProject(scope, doc.project.clientId, doc.project.id)) {
    return fail("Documento no encontrado", 404);
  }
  if (doc.status === "APPROVED") {
    return fail("El documento ya fue aprobado", 409);
  }
  if (doc.status !== "SENT") {
    return fail("El documento aún no está disponible para aprobar", 409);
  }

  await prisma.designDoc.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  await writeAudit({
    userId: scope.userId,
    action: "approve",
    resource: "design_doc",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
