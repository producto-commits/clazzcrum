import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok } from "@/server/http";
import { commentCreateSchema } from "@/server/validation/scrum";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/stories/[id]/comments — agrega un comentario al hilo de la historia.
export async function POST(req: Request, { params }: Ctx) {
  // Requiere poder leer la historia (permite comentar a staff y clientes).
  const auth = await requirePermission("read", "story");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, commentCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const comment = await prisma.comment.create({
    data: { storyId: id, userId: auth.session.userId, body: parsed.data.body },
    include: { user: { select: { id: true, name: true } } },
  });
  return ok(comment, { status: 201 });
}
