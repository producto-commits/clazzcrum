import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { verifyAccessToken, verifyRefreshToken, type SessionPayload } from "./jwt";
import { rotateRefreshToken } from "./tokens";

export const ACCESS_COOKIE = "clazz_access";
export const REFRESH_COOKIE = "clazz_refresh";

const ACCESS_MAX_AGE = 15 * 60; // 15 min
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 días

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, accessToken, cookieOpts(ACCESS_MAX_AGE));
  jar.set(REFRESH_COOKIE, refreshToken, cookieOpts(REFRESH_MAX_AGE));
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, "", cookieOpts(0));
  jar.set(REFRESH_COOKIE, "", cookieOpts(0));
}

// Lee y verifica la sesión. Si el access token expiró pero el refresh
// aún es válido, lo rota transparentemente para no botar al usuario al
// cambiar de módulo. En Server Components no se pueden setear cookies —
// se ignora el error y solo se devuelve el payload; el navegador refrescará
// las cookies en el próximo POST del cliente / hit del proxy.
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (access) {
    const s = await verifyAccessToken(access);
    if (s) return s;
  }
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const rPayload = await verifyRefreshToken(refresh);
  if (!rPayload) return null;
  const rotated = await rotateRefreshToken(rPayload.userId, rPayload.tokenId, refresh);
  if (!rotated) return null;
  try {
    await setAuthCookies(rotated.accessToken, rotated.refreshToken);
  } catch {
    // Contexto de solo-lectura (Server Component). Ignoramos; devolvemos el
    // payload del token recién rotado para servir esta request.
  }
  return verifyAccessToken(rotated.accessToken);
}

// Carga el usuario completo (con roles) desde la BD.
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user || !user.isActive) return null;
  return user;
}

// Permisos efectivos del usuario (unión de los permisos de sus roles).
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { users: { some: { userId } } } },
    include: { permission: true },
  });
  return new Set(rows.map((r) => `${r.permission.action}:${r.permission.resource}`));
}

export async function userHasPermission(
  userId: string,
  action: string,
  resource: string,
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.has(`${action}:${resource}`);
}
