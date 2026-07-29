import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/guard";
import { computeSlaDueDates } from "@/server/services/tickets";
import { putObject } from "@/server/storage/s3";
import { writeAudit } from "@/server/audit";
import { ok, fail, clientIp } from "@/server/http";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
]);

// Resuelve (una sola vez, con cache) el usuario al que se asignan los bug
// reports: variable de entorno, o un usuario cuyo email/nombre sea "Diego
// Forero" (útil para prod). Cae al primer admin activo si no encuentra.
let cachedAssigneeId: string | null = null;
async function resolveAssignee(): Promise<string | null> {
  if (cachedAssigneeId) {
    // Aún válido si ese usuario sigue activo.
    const still = await prisma.user.findUnique({
      where: { id: cachedAssigneeId },
      select: { id: true, isActive: true },
    });
    if (still?.isActive) return still.id;
    cachedAssigneeId = null;
  }
  const byEnv = process.env.BUG_REPORTS_ASSIGNEE_EMAIL;
  if (byEnv) {
    const u = await prisma.user.findFirst({ where: { email: byEnv, isActive: true }, select: { id: true } });
    if (u) return (cachedAssigneeId = u.id);
  }
  // Por nombre: "Diego Forero" (case-insensitive contains).
  const byName = await prisma.user.findFirst({
    where: {
      isActive: true,
      name: { contains: "Diego Forero", mode: "insensitive" },
    },
    select: { id: true },
  });
  if (byName) return (cachedAssigneeId = byName.id);
  // Fallback: primer admin activo.
  const anyAdmin = await prisma.user.findFirst({
    where: {
      isActive: true,
      roles: { some: { role: { key: "admin" } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return anyAdmin?.id ?? null;
}

// Cliente contenedor de los bugs internos. Se guarda por env o por nombre
// "Clazz" / "Clazz Digital". Si no existe, se crea uno "Clazzcrum — bugs internos".
let cachedClientId: string | null = null;
async function resolveClient(): Promise<string> {
  if (cachedClientId) {
    const still = await prisma.client.findUnique({ where: { id: cachedClientId }, select: { id: true } });
    if (still) return still.id;
    cachedClientId = null;
  }
  const envId = process.env.BUG_REPORTS_CLIENT_ID;
  if (envId) {
    const c = await prisma.client.findUnique({ where: { id: envId }, select: { id: true } });
    if (c) return (cachedClientId = c.id);
  }
  const byName = await prisma.client.findFirst({
    where: { name: { in: ["Clazz", "Clazz Digital"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (byName) return (cachedClientId = byName.id);
  const created = await prisma.client.create({
    data: { name: "Clazzcrum — bugs internos" },
    select: { id: true },
  });
  return (cachedClientId = created.id);
}

// POST /api/bug-reports (multipart: module, description, file?)
//   Crea un ticket interno con prioridad ALTA asignado a Diego (o al admin
//   configurado como responsable). Si se adjunta imagen/PDF, se sube al
//   almacenamiento y se vincula al ticket como attachment.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Solo staff reporta bugs de la plataforma; los clientes usan su portal.
  const roles = auth.session.roles;
  const isStaff =
    roles.includes("admin") || roles.includes("tech_lead") || roles.includes("developer");
  if (!isStaff) return fail("Solo el equipo interno puede reportar bugs", 403);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Formulario inválido", 400);

  const module_ = String(form.get("module") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const file = form.get("file");

  if (module_.length < 2 || module_.length > 80) {
    return fail("Indica el módulo donde ocurre el error.", 422);
  }
  if (description.length < 5 || description.length > 4000) {
    return fail("Describe el error con al menos 5 caracteres.", 422);
  }
  const fileToUpload = file instanceof File && file.size > 0 ? file : null;
  if (fileToUpload) {
    if (fileToUpload.size > MAX_BYTES) return fail("La captura supera 15 MB.", 413);
    if (!ALLOWED_MIME.has(fileToUpload.type)) {
      return fail("Formato de captura no permitido (usa PNG, JPG, WEBP, GIF o PDF).", 415);
    }
  }

  const [assigneeId, clientId, reporter] = await Promise.all([
    resolveAssignee(),
    resolveClient(),
    prisma.user.findUnique({
      where: { id: auth.session.userId },
      select: { name: true, email: true },
    }),
  ]);
  if (!assigneeId) return fail("No hay responsable configurado para bugs internos.", 500);

  const sla = await computeSlaDueDates("HIGH");
  const shortDesc = description.length > 60 ? description.slice(0, 57) + "…" : description;
  const subject = `[Bug · ${module_}] ${shortDesc}`;
  const reporterLabel = reporter ? `${reporter.name} (${reporter.email})` : auth.session.userId;
  const fullDescription =
    `**Reporte de error de Clazzcrum**\n\n` +
    `- Módulo: ${module_}\n` +
    `- Reportado por: ${reporterLabel}\n\n` +
    `**Descripción**\n${description}`;

  const ticket = await prisma.ticket.create({
    data: {
      clientId,
      reporterId: auth.session.userId,
      subject,
      description: fullDescription,
      priority: "HIGH",
      status: "ASSIGNED",
      assigneeId,
      ...sla,
    },
  });

  // Subida de la captura (best-effort: si falla el storage, dejamos el
  // ticket creado y avisamos al frontend con un campo, en vez de tumbar todo).
  let attachmentError: string | null = null;
  if (fileToUpload) {
    try {
      const buffer = Buffer.from(await fileToUpload.arrayBuffer());
      const safeName =
        fileToUpload.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "captura";
      const key = `ticket/${ticket.id}/${crypto.randomUUID()}-${safeName}`;
      await putObject(key, buffer, fileToUpload.type);
      await prisma.attachment.create({
        data: {
          entityType: "ticket",
          entityId: ticket.id,
          fileName: safeName,
          mimeType: fileToUpload.type,
          size: fileToUpload.size,
          storageKey: key,
          uploadedById: auth.session.userId,
        },
      });
    } catch (err) {
      attachmentError = err instanceof Error ? err.message : "No se pudo adjuntar";
      // eslint-disable-next-line no-console
      console.error("[bug-reports] fallo al subir captura:", err);
    }
  }

  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "ticket",
    resourceId: ticket.id,
    metadata: { source: "bug-report", module: module_ },
    ip: clientIp(req),
  });

  return ok({ id: ticket.id, number: ticket.number, attachmentError }, { status: 201 });
}
