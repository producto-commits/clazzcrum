import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/guard";
import { getObject, deleteObject } from "@/server/storage/s3";
import { fail, ok, clientIp } from "@/server/http";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/attachments/[id] — descarga el archivo (stream desde MinIO).
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return fail("Adjunto no encontrado", 404);

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const obj = await getObject(att.storageKey);
  return new Response(obj.body, {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${att.fileName}"`,
    },
  });
}

// DELETE /api/attachments/[id]
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return fail("Adjunto no encontrado", 404);

  await deleteObject(att.storageKey);
  await prisma.attachment.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "attachment",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
