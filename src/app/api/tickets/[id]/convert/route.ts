import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { convertSchema } from "@/server/validation/servicedesk";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/tickets/[id]/convert — convierte el caso en una historia de usuario
// (trazabilidad soporte → SCRUM). Requiere poder crear historias.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePermission("create", "story");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, convertSchema);
  if (parsed instanceof NextResponse) return parsed;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return fail("Caso no encontrado", 404);
  if (ticket.linkedStoryId) return fail("El caso ya está vinculado a una historia", 409);

  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project) return fail("Proyecto no encontrado", 404);

  const story = await prisma.userStory.create({
    data: {
      projectId: project.id,
      title: ticket.subject,
      iWant: ticket.subject,
      soThat: "resolver el caso de soporte reportado",
      status: "BACKLOG",
      priority: ticket.priority,
    },
  });
  await prisma.ticket.update({
    where: { id },
    data: { linkedStoryId: story.id },
  });

  await writeAudit({
    userId: auth.session.userId,
    action: "convert_to_story",
    resource: "ticket",
    resourceId: id,
    metadata: { storyId: story.id, projectId: project.id },
    ip: clientIp(req),
  });
  return ok({ ok: true, storyId: story.id });
}
