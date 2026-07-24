import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePortal, clientCanSeeProject } from "@/server/auth/portal";
import { ok, fail } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/portal/design-docs/[id] — detalle del documento para el cliente
// (versión actual + comentarios), solo si está ENVIADO/APROBADO y es suyo.
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePortal();
  if (auth instanceof NextResponse) return auth;
  const { scope } = auth;
  const { id } = await params;

  const doc = await prisma.designDoc.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, clientId: true, client: { select: { name: true } } } },
      versions: { orderBy: { version: "desc" } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  if (
    !doc ||
    (doc.status !== "SENT" && doc.status !== "APPROVED") ||
    !clientCanSeeProject(scope, doc.project.clientId, doc.project.id)
  ) {
    return fail("Documento no encontrado", 404);
  }

  const current = doc.versions.find((v) => v.version === doc.currentVersion) ?? doc.versions[0];
  return ok({ ...doc, current });
}
