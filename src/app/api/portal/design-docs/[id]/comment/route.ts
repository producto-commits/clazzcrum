import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePortal, clientCanSeeProject } from "@/server/auth/portal";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

const commentSchema = z.object({ body: z.string().trim().min(1).max(4000) });

// POST /api/portal/design-docs/[id]/comment — el cliente deja un comentario
// (retroalimentación para los avances). Si el documento ya está aprobado,
// queda bloqueado y no admite comentarios.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePortal();
  if (auth instanceof NextResponse) return auth;
  const { scope } = auth;
  const { id } = await params;

  const parsed = await parseBody(req, commentSchema);
  if (parsed instanceof NextResponse) return parsed;

  const doc = await prisma.designDoc.findUnique({
    where: { id },
    include: { project: { select: { id: true, clientId: true } } },
  });
  if (
    !doc ||
    (doc.status !== "SENT" && doc.status !== "APPROVED") ||
    !clientCanSeeProject(scope, doc.project.clientId, doc.project.id)
  ) {
    return fail("Documento no encontrado", 404);
  }
  if (doc.status === "APPROVED") {
    return fail("El documento está aprobado; ya no admite comentarios", 409);
  }

  const comment = await prisma.designDocComment.create({
    data: {
      designDocId: id,
      version: doc.currentVersion,
      body: parsed.data.body,
      authorId: scope.userId,
    },
    include: { author: { select: { id: true, name: true } } },
  });
  await writeAudit({
    userId: scope.userId,
    action: "comment",
    resource: "design_doc",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok(comment, { status: 201 });
}
