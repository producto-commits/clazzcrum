import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { verifyAccessToken, type SessionPayload } from "./jwt";

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

// Lee y verifica la sesión desde la cookie de acceso (sin tocar BD).
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
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
