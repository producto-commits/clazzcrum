import { cookies } from "next/headers";
import { verifyRefreshToken } from "@/server/auth/jwt";
import { revokeRefreshToken } from "@/server/auth/tokens";
import { clearAuthCookies, REFRESH_COOKIE } from "@/server/auth/session";
import { writeAudit } from "@/server/audit";
import { ok, clientIp } from "@/server/http";

// POST /api/auth/logout — revoca el refresh token y borra las cookies.
export async function POST(req: Request) {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    const payload = await verifyRefreshToken(refresh);
    if (payload) {
      await revokeRefreshToken(payload.tokenId);
      await writeAudit({
        userId: payload.userId,
        action: "logout",
        resource: "user",
        resourceId: payload.userId,
        ip: clientIp(req),
      });
    }
  }
  await clearAuthCookies();
  return ok({ ok: true });
}
