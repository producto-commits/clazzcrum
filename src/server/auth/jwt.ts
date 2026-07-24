import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Firmado/verificación de JWT con jose (compatible con edge, para usar en proxy.ts).

const encoder = new TextEncoder();

function accessSecret() {
  return encoder.encode(process.env.JWT_ACCESS_SECRET ?? "dev-access-secret");
}
function refreshSecret() {
  return encoder.encode(process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret");
}

export type SessionPayload = {
  userId: string;
  email: string;
  roles: string[]; // claves de rol: admin | client | developer | tech_lead
};

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL ?? "7d";

export async function signAccessToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(accessSecret());
}

// El refresh token solo referencia al usuario y a un id de token (rotación en BD).
export async function signRefreshToken(userId: string, tokenId: string): Promise<string> {
  return new SignJWT({ userId, tokenId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(refreshSecret());
}

export async function verifyAccessToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    const p = payload as JWTPayload & Partial<SessionPayload>;
    if (!p.userId || !p.email || !Array.isArray(p.roles)) return null;
    return { userId: p.userId, email: p.email, roles: p.roles };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ userId: string; tokenId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    const p = payload as JWTPayload & { userId?: string; tokenId?: string };
    if (!p.userId || !p.tokenId) return null;
    return { userId: p.userId, tokenId: p.tokenId };
  } catch {
    return null;
  }
}
