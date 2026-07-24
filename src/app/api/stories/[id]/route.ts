import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail, clientIp } from "@/server/http";
import { storyUpdateSchema } from "@/server/validation/scrum";
import { writeAudit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePermission("read", "story");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const story = await prisma.userStory.findUnique({
    where: { id },
    include: {
      assignees: { include: { user: { select: { id: true, name: true } } } },
      epic: { select: { id: true, title: true } },
      sprint: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, clientId: true } },
      tasks: { orderBy: { order: "asc" }, include: { assignee: { select: { id: true, name: true } } } },
      acceptanceCriteria: { orderBy: { order: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!story) return fail("Historia no encontrada", 404);
  return ok(story);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePermission("edit", "story");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, storyUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { assigneeIds, ...data } = parsed.data;

  // Jerarquía anidada: al cambiar de épica, la historia hereda el sprint de esa épica.
  if (data.epicId !== undefined) {
    if (data.epicId) {
      const epic = await prisma.epic.findUnique({
        where: { id: data.epicId },
        select: { sprintId: true },
      });
      data.sprintId = epic?.sprintId ?? null;
    } else {
      data.sprintId = null;
    }
  }

  // Reglas al pasar a Completado.
  if (data.status) {
    const current = await prisma.userStory.findUnique({
      where: { id },
      select: { status: true, actualEnd: true, completionEvidence: true },
    });

    if (data.status === "DONE" && current?.status !== "DONE") {
      // Evidencia obligatoria: descripción + al menos un adjunto.
      const evidence = (data.completionEvidence ?? current?.completionEvidence ?? "").trim();
      if (!evidence) {
        return fail("Para completar la historia debes describir la evidencia", 422, {
          requiresEvidence: true,
        });
      }
      const attachments = await prisma.attachment.count({
        where: { entityType: "story", entityId: id },
      });
      if (attachments === 0) {
        return fail("Para completar la historia debes adjuntar al menos una evidencia", 422, {
          requiresEvidence: true,
        });
      }
      // Registrar la fecha real de fin.
      if (data.actualEnd === undefined && !current?.actualEnd) data.actualEnd = new Date();
    } else if (data.status !== "DONE" && current?.status === "DONE" && data.actualEnd === undefined) {
      data.actualEnd = null;
    }
  }

  const story = await prisma.$transaction(async (tx) => {
    if (assigneeIds) {
      await tx.storyAssignee.deleteMany({ where: { storyId: id } });
      if (assigneeIds.length) {
        await tx.storyAssignee.createMany({
          data: assigneeIds.map((userId) => ({ storyId: id, userId })),
        });
      }
    }
    return tx.userStory.update({
      where: { id },
      data,
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
        epic: { select: { id: true, title: true } },
        _count: { select: { tasks: true, comments: true, acceptanceCriteria: true } },
      },
    });
  });

  await writeAudit({
    userId: auth.session.userId,
    action: data.status ? "status_change" : "update",
    resource: "story",
    resourceId: id,
    metadata: data.status ? { status: data.status } : undefined,
    ip: clientIp(req),
  });
  return ok(story);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requirePermission("delete", "story");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.userStory.delete({ where: { id } });
  await writeAudit({
    userId: auth.session.userId,
    action: "delete",
    resource: "story",
    resourceId: id,
    ip: clientIp(req),
  });
  return ok({ ok: true });
}
