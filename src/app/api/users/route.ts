import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/guard";
import { ok } from "@/server/http";

// GET /api/users?assignable=1 — usuarios del equipo (staff) para asignar historias/tareas.
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { key: { in: ["admin", "developer", "tech_lead"] } } } },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return ok(users);
}
