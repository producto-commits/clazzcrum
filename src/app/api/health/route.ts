import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

// GET /api/health — comprobación de estado de la app y la base de datos.
export async function GET() {
  try {
    const [users, roles, permissions, slaPolicies] = await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.sLAPolicy.count(),
    ]);

    return NextResponse.json({
      status: "ok",
      db: "connected",
      counts: { users, roles, permissions, slaPolicies },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        message: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
