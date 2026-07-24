import { cookies } from "next/headers";
import { verifyRefreshToken } from "@/server/auth/jwt";
import { rotateRefreshToken } from "@/server/auth/tokens";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from "@/server/auth/session";
import { ok, fail } from "@/server/http";

// POST /api/auth/refresh — renueva el access token rotando el refresh token.
export async function POST() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) return fail("No autenticado", 401);

  const payload = await verifyRefreshToken(refresh);
  if (!payload) {
    await clearAuthCookies();
    return fail("Sesión inválida", 401);
  }

  const rotated = await rotateRefreshToken(payload.userId, payload.tokenId, refresh);
  if (!rotated) {
    await clearAuthCookies();
    return fail("Sesión expirada", 401);
  }

  await setAuthCookies(rotated.accessToken, rotated.refreshToken);
  return ok({ ok: true });
}
