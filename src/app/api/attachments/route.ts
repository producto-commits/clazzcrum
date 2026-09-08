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

const MAX_URL = 2048;
const MAX_LABEL = 160;

// Normaliza y valida un enlace de evidencia: solo http(s), tamaño acotado.
function parseEvidenceUrl(raw: unknown): URL | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

// POST /api/attachments
//   - multipart: entityType, entityId, file          → sube un archivo
//   - JSON:      { entityType, entityId, url, label } → registra un enlace
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return createLink(req);

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

  try {
    await putObject(key, buffer, file.type || "application/octet-stream");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[attachments] Error al subir a S3/MinIO:", err);
    return fail(
      err instanceof Error
        ? err.message
        : "No se pudo subir el archivo al almacenamiento",
      502,
    );
  }

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

// Enlace como evidencia: no hay objeto en el storage, solo el registro.
async function createLink(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Cuerpo inválido", 400);
  const entityType = String(body.entityType ?? "");
  const entityId = String(body.entityId ?? "");

  const guard = guardFor(entityType);
  if (!guard) return fail("Tipo de entidad inválido", 400);
  const auth = await requirePermission(guard[0], guard[1]);
  if (auth instanceof NextResponse) return auth;
  if (!entityId) return fail("entityId requerido", 400);

  const url = parseEvidenceUrl(body.url);
  if (!url) return fail("Indica un enlace válido (http:// o https://)", 400);

  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, MAX_LABEL)
      : `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`.slice(0, MAX_LABEL);

  const attachment = await prisma.attachment.create({
    data: {
      entityType,
      entityId,
      fileName: label,
      mimeType: "text/uri-list",
      size: 0,
      storageKey: "",
      url: url.toString(),
      uploadedById: auth.session.userId,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  await writeAudit({
    userId: auth.session.userId,
    action: "upload",
    resource: "attachment",
    resourceId: attachment.id,
    metadata: { entityType, entityId, url: attachment.url },
    ip: clientIp(req),
  });
  return ok(attachment, { status: 201 });
}
