import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePortal, clientCanSeeProject } from "@/server/auth/portal";
import { fail } from "@/server/http";
import { renderDesignDocPdf } from "@/server/pdf/designDocPdf";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/portal/design-docs/[id]/pdf — PDF de la versión actual para el cliente.
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
  const answers = (current?.answers ?? {}) as Record<string, string>;

  const buffer = await renderDesignDocPdf({
    title: doc.title,
    version: doc.currentVersion,
    status: doc.status,
    projectName: doc.project.name,
    clientName: doc.project.client.name,
    answers,
  });

  const safeName = doc.title.replace(/[^\w\d]+/g, "_").slice(0, 60);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}_v${doc.currentVersion}.pdf"`,
    },
  });
}
