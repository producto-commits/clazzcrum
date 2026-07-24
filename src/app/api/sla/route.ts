import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/guard";
import { ok } from "@/server/http";

const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

// GET /api/sla — políticas de SLA por prioridad (config del admin).
export async function GET() {
  const auth = await requirePermission("read", "sla");
  if (auth instanceof NextResponse) return auth;
  const policies = await prisma.sLAPolicy.findMany();
  policies.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
  return ok(policies);
}
