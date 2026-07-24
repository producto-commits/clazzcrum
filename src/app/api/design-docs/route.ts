import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, clientIp } from "@/server/http";
import { designDocCreateSchema } from "@/server/validation/designdoc";
import { writeAudit } from "@/server/audit";

// GET /api/design-docs?projectId= — lista de documentos de diseño.
export async function GET(req: Request) {
  const auth = await requirePermission("read", "design_doc");
  if (auth instanceof NextResponse) return auth;
  const projectId = new URL(req.url).searchParams.get("projectId");

  const docs = await prisma.designDoc.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { project: { select: { id: true, name: true } } },
  });
  return ok(docs);
}

// POST /api/design-docs — crea un documento (con su versión 1 en borrador).
export async function POST(req: Request) {
  const auth = await requirePermission("create", "design_doc");
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, designDocCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const doc = await prisma.designDoc.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      currentVersion: 1,
      versions: { create: { version: 1, answers: {} } },
    },
  });
  await writeAudit({
    userId: auth.session.userId,
    action: "create",
    resource: "design_doc",
    resourceId: doc.id,
    ip: clientIp(req),
  });
  return ok(doc, { status: 201 });
}
