import { getCurrentUser, getUserPermissions } from "@/server/auth/session";
import { ok, fail } from "@/server/http";

// GET /api/auth/me — datos de la sesión actual (usuario, roles, permisos).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("No autenticado", 401);

  const permissions = await getUserPermissions(user.id);
  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((r) => ({ key: r.role.key, name: r.role.name })),
    permissions: [...permissions],
  });
}
