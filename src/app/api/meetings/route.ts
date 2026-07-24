import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/portal";
import { parseBody, ok } from "@/server/http";
import { replanForUser } from "@/server/services/planning";

const schema = z.object({
  title: z.string().trim().min(2).max(200),
  date: z.coerce.date(),
  hours: z.coerce.number().min(0.25).max(24),
  note: z.string().trim().max(1000).optional().nullable(),
  attendeeIds: z.array(z.string()).min(1).max(50),
});

// GET /api/meetings — reuniones (equipo), próximas primero.
export async function GET() {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  const meetings = await prisma.meeting.findMany({
    orderBy: { date: "desc" },
    include: { attendees: { include: { user: { select: { id: true, name: true } } } } },
    take: 200,
  });
  return ok(meetings);
}

// POST /api/meetings — programa una reunión: resta capacidad a los asistentes
// (CapacityEvent source="meeting") y REPLANIFICA sus proyectos.
export async function POST(req: Request) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, schema);
  if (parsed instanceof NextResponse) return parsed;
  const { title, date, hours, note, attendeeIds } = parsed.data;
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const meeting = await prisma.meeting.create({
    data: {
      title,
      date: day,
      hours,
      note: note ?? null,
      attendees: { create: attendeeIds.map((userId) => ({ userId })) },
    },
  });
  // Huella de capacidad por asistente.
  await prisma.capacityEvent.createMany({
    data: attendeeIds.map((userId) => ({
      userId,
      date: day,
      hours,
      source: "meeting",
      refId: meeting.id,
      note: title,
    })),
  });
  // Correr los cronogramas de los proyectos de cada asistente.
  for (const userId of attendeeIds) await replanForUser(userId);

  return ok(meeting, { status: 201 });
}
