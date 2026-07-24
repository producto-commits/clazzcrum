import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { fail } from "@/server/http";
import { renderDesignDocPdf } from "@/server/pdf/designDocPdf";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/design-docs/[id]/pdf — genera y descarga el PDF de la versión actual.
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "design_doc");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const doc = await prisma.designDoc.findUnique({
    where: { id },
    include: {
      project: { select: { name: true, client: { select: { name: true } } } },
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!doc) return fail("Documento no encontrado", 404);

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
      "Content-Disposition": `attachment; filename="${safeName}_v${doc.currentVersion}.pdf"`,
    },
  });
}
