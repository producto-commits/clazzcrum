import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { designDocSaveSchema } from "@/server/validation/designdoc";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "design_doc");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const doc = await prisma.designDoc.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
      versions: { orderBy: { version: "desc" } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  if (!doc) return fail("Documento no encontrado", 404);

  const current = doc.versions.find((v) => v.version === doc.currentVersion) ?? doc.versions[0];
  return ok({ ...doc, current });
}

// PATCH — guarda respuestas de la versión actual, título o estado.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "design_doc");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, designDocSaveSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { answers, title, status } = parsed.data;

  const doc = await prisma.designDoc.findUnique({ where: { id } });
  if (!doc) return fail("Documento no encontrado", 404);

  if (answers) {
    await prisma.designDocVersion.updateMany({
      where: { designDocId: id, version: doc.currentVersion },
      data: { answers: answers as Prisma.InputJsonValue },
    });
  }
  const docData: Prisma.DesignDocUpdateInput = {};
  if (title) docData.title = title;
  if (status) docData.status = status;
  if (Object.keys(docData).length) {
    await prisma.designDoc.update({ where: { id }, data: docData });
  }

  if (status) {
    await writeAudit({
      userId: auth.session.userId,
      action: "status_change",
      resource: "design_doc",
      resourceId: id,
      metadata: { status },
      ip: clientIp(req),
    });
  }
  return ok({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "design_doc");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.designDoc.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "design_doc",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
