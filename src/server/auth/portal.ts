import { NextResponse } from "next/server";
import { getSession } from "./session";
import { resolveScope, type AccessScope } from "./scope";

// Guarda para el PORTAL DEL CLIENTE. Solo usuarios NO staff (rol client).
// Uso:
//   const auth = await requirePortal();
//   if (auth instanceof NextResponse) return auth;
//   const { scope } = auth;
export async function requirePortal(): Promise<{ scope: AccessScope } | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const scope = await resolveScope(session);
  if (scope.isStaff) {
    return NextResponse.json({ error: "Solo disponible para clientes" }, { status: 403 });
  }
  return { scope };
}

// Guarda para funciones internas del EQUIPO (no clientes).
export async function requireStaff(): Promise<{ scope: AccessScope } | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const scope = await resolveScope(session);
  if (!scope.isStaff) return NextResponse.json({ error: "Solo para el equipo" }, { status: 403 });
  return { scope };
}

// ¿El cliente puede ver un proyecto? (por su cliente y, opcionalmente, por
// la lista de proyectos permitidos).
export function clientCanSeeProject(
  scope: AccessScope,
  projectClientId: string | null,
  projectId: string,
): boolean {
  if (!scope.clientId || projectClientId !== scope.clientId) return false;
  if (scope.projectIds && !scope.projectIds.includes(projectId)) return false;
  return true;
}
