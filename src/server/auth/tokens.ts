import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { signAccessToken, signRefreshToken, type SessionPayload } from "./jwt";

// Emisión y rotación de tokens. El refresh token se guarda hasheado en BD
// (tabla RefreshToken) para poder revocarlo y rotarlo.

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function buildSessionPayload(userId: string): Promise<SessionPayload> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  return {
    userId: user.id,
    email: user.email,
    roles: user.roles.map((r) => r.role.key),
  };
}

// Crea un par de tokens nuevo y persiste el refresh (hasheado).
export async function issueTokenPair(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const payload = await buildSessionPayload(userId);
  const accessToken = await signAccessToken(payload);

  const record = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: "pending", // se reemplaza abajo
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  const refreshToken = await signRefreshToken(userId, record.id);
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.refreshToken.update({ where: { id: record.id }, data: { tokenHash } });

  return { accessToken, refreshToken };
}

// Rota un refresh token: valida el actual, lo revoca y emite uno nuevo.
export async function rotateRefreshToken(
  userId: string,
  tokenId: string,
  presentedToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const record = await prisma.refreshToken.findUnique({ where: { id: tokenId } });
  if (
    !record ||
    record.userId !== userId ||
    record.revokedAt ||
    record.expiresAt.getTime() < Date.now()
  ) {
    return null;
  }
  const valid = await bcrypt.compare(presentedToken, record.tokenHash);
  if (!valid) return null;

  // Revocar el actual y emitir uno nuevo (rotación)
  await prisma.refreshToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
  return issueTokenPair(userId);
}

// Revoca un refresh token (logout).
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await prisma.refreshToken
    .update({ where: { id: tokenId }, data: { revokedAt: new Date() } })
    .catch(() => {});
}
