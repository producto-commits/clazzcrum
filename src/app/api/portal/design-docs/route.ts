import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePortal } from "@/server/auth/portal";
import { ok } from "@/server/http";

// GET /api/portal/design-docs — documentos de diseño visibles para el cliente
// (solo los ENVIADOS o APROBADOS de sus proyectos).
export async function GET() {
  const auth = await requirePortal();
  if (auth instanceof NextResponse) return auth;
  const { scope } = auth;

  const docs = await prisma.designDoc.findMany({
    where: {
      status: { in: ["SENT", "APPROVED"] },
      project: {
        clientId: scope.clientId ?? "__none__",
        ...(scope.projectIds ? { id: { in: scope.projectIds } } : {}),
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });
  return ok(docs);
}
