import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAuth, requirePermission } from "@/server/auth/guard";
import { parseBody, ok } from "@/server/http";
import { z } from "zod";

// GET /api/ticket-categories — categorías de casos (para el formulario).
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const categories = await prisma.ticketCategory.findMany({ orderBy: { name: "asc" } });
  return ok(categories);
}

// POST /api/ticket-categories — crea una categoría (admin: configura la mesa).
export async function POST(req: Request) {
  const auth = await requirePermission("edit", "sla"); // config de mesa = admin
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, z.object({ name: z.string().trim().min(1).max(80) }));
  if (parsed instanceof NextResponse) return parsed;
  const category = await prisma.ticketCategory.create({ data: { name: parsed.data.name } });
  return ok(category, { status: 201 });
}
