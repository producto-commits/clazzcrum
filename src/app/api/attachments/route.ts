import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAuth, requirePermission } from "@/server/auth/guard";
import { putObject } from "@/server/storage/s3";
import { ok, fail, clientIp } from "@/server/http";
import { writeAudit } from "@/server/audit";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];

// Permiso requerido para adjuntar/gestionar según el tipo de entidad.
function guardFor(entityType: string): [string, string] | null {
  switch (entityType) {
    case "story":
    case "task":
      return ["edit", "story"];
    case "ticket":
      return ["read", "ticket"]; // los clientes pueden adjuntar a sus casos
    case "design_doc":
      return ["edit", "design_doc"];
    default:
      return null;
  }
}

// GET /api/attachments?entityType=&entityId=
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const sp = new URL(req.url).searchParams;
  const entityType = sp.get("entityType");
  const entityId = sp.get("entityId");
  if (!entityType || !entityId) return fail("entityType y entityId requeridos", 400);

  const items = await prisma.attachment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  return ok(items);
}

// POST /api/attachments (multipart: entityType, entityId, file)
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Formulario inválido", 400);
  const entityType = String(form.get("entityType") ?? "");
  const entityId = String(form.get("entityId") ?? "");
  const file = form.get("file");

  const guard = guardFor(entityType);
  if (!guard) return fail("Tipo de entidad inválido", 400);
  const auth = await requirePermission(guard[0], guard[1]);
  if (auth instanceof NextResponse) return auth;

  if (!(file instanceof File)) return fail("Archivo requerido", 400);
  if (file.size === 0) return fail("El archivo está vacío", 400);
  if (file.size > MAX_BYTES) return fail("El archivo supera 15 MB", 413);
  if (!ALLOWED.includes(file.type)) return fail("Tipo de archivo no permitido", 415);

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "archivo";
  const key = `${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`;

  await putObject(key, buffer, file.type || "application/octet-stream");

  const attachment = await prisma.attachment.create({
    data: {
      entityType,
      entityId,
      fileName: safeName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storageKey: key,
      uploadedById: auth.session.userId,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  await writeAudit({
    userId: auth.session.userId,
    action: "upload",
    resource: "attachment",
    resourceId: attachment.id,
    metadata: { entityType, entityId },
    ip: clientIp(req),
  });
  return ok(attachment, { status: 201 });
}
