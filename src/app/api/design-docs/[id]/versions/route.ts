import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { designDocVersionSchema } from "@/server/validation/designdoc";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/design-docs/[id]/versions — crea una nueva versión (v+1) copiando
// las respuestas actuales, para reflejar ajustes tras revisión del cliente.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "design_doc");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, designDocVersionSchema);
  if (parsed instanceof NextResponse) return parsed;

  const doc = await prisma.designDoc.findUnique({
    where: { id },
    include: { versions: { where: {}, orderBy: { version: "desc" } } },
  });
  if (!doc) return fail("Documento no encontrado", 404);

  const current = doc.versions.find((v) => v.version === doc.currentVersion) ?? doc.versions[0];
  const nextVersion = doc.currentVersion + 1;

  await prisma.designDocVersion.create({
    data: {
      designDocId: id,
      version: nextVersion,
      answers: (current?.answers ?? {}) as Prisma.InputJsonValue,
      changeNote: parsed.data.changeNote ?? null,
    },
  });
  await prisma.designDoc.update({
    where: { id },
    data: { currentVersion: nextVersion, status: "DRAFT" },
  });

  await writeAudit({
    userId: auth.session.userId,
    action: "new_version",
    resource: "design_doc",
    resourceId: id,
    metadata: { version: nextVersion },
    ip: clientIp(req),
  });
  return ok({ ok: true, version: nextVersion });
}
