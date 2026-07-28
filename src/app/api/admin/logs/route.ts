import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { ok } from "@/server/http";

// GET /api/admin/logs — auditoría (solo admin).
// Filtros opcionales: ?action, ?resource, ?userId, ?since, ?until, ?limit
export async function GET(req: Request) {
  const auth = await requirePermission("read", "user");
  if (auth instanceof NextResponse) return auth;

  const sp = new URL(req.url).searchParams;
  const where: Prisma.AuditLogWhereInput = {};
  const action = sp.get("action");
  if (action) where.action = action;
  const resource = sp.get("resource");
  if (resource) where.resource = resource;
  const userId = sp.get("userId");
  if (userId) where.userId = userId;
  const since = sp.get("since");
  const until = sp.get("until");
  if (since || until) {
    where.createdAt = {};
    if (since) where.createdAt.gte = new Date(`${since}T00:00:00.000Z`);
    if (until) where.createdAt.lt = new Date(`${until}T00:00:00.000Z`);
  }
  const q = sp.get("q");
  if (q) {
    where.OR = [
      { resourceId: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }
  const limit = Math.min(500, Math.max(10, Number(sp.get("limit") ?? 100)));

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true, roles: { select: { role: { select: { key: true, name: true } } } } } },
    },
  });
  return ok(logs);
}
