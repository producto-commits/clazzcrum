import { NextResponse } from "next/server";
import { getSession, userHasPermission } from "./session";
import type { SessionPayload } from "./jwt";

// Guardas para rutas API. Uso en un route handler:
//
//   const auth = await requireAuth();
//   if (auth instanceof NextResponse) return auth;   // 401
//   const { session } = auth;
//
//   const auth = await requirePermission("create", "project");
//   if (auth instanceof NextResponse) return auth;    // 401 o 403

export async function requireAuth(): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return { session };
}

export async function requirePermission(
  action: string,
  resource: string,
): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const allowed = await userHasPermission(session.userId, action, resource);
  if (!allowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return { session };
}
