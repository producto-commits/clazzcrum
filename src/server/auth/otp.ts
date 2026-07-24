import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import type { OtpPurpose } from "@prisma/client";

// Reglas de OTP (código de 6 dígitos enviado al correo).
export const OTP_TTL_MINUTES = 15; // expiración
export const OTP_RESEND_COOLDOWN_SECONDS = 60; // tiempo mínimo entre reenvíos
export const OTP_MAX_ATTEMPTS = 5; // intentos fallidos antes de invalidar

function generateCode(): string {
  // 6 dígitos, con ceros a la izquierda. crypto para aleatoriedad segura.
  const n = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000);
  return n.toString().padStart(6, "0");
}

export type IssueResult =
  | { ok: true; code: string; retryAfter?: never }
  | { ok: false; retryAfter: number }; // segundos que faltan para poder reenviar

/**
 * Genera un nuevo OTP para el usuario y propósito dado, respetando el cooldown
 * de reenvío. Invalida cualquier OTP previo del mismo propósito.
 * Devuelve el código en claro (para enviarlo por correo); en BD solo se guarda el hash.
 */
export async function issueOtp(userId: string, purpose: OtpPurpose): Promise<IssueResult> {
  const existing = await prisma.otpCode.findFirst({
    where: { userId, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const elapsed = (Date.now() - existing.lastSentAt.getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return { ok: false, retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed) };
    }
  }

  // Invalidar OTPs anteriores del mismo propósito
  await prisma.otpCode.deleteMany({ where: { userId, purpose } });

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { userId, purpose, codeHash, expiresAt, lastSentAt: new Date() },
  });

  return { ok: true, code };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many_attempts" | "invalid" };

/**
 * Verifica un OTP. Es de un solo uso: al acertar se marca como usado.
 * Cuenta intentos fallidos y lo invalida al superar el máximo.
 */
export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
): Promise<VerifyResult> {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, reason: "no_code" };

  if (otp.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.delete({ where: { id: otp.id } });
    return { ok: false, reason: "expired" };
  }

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.delete({ where: { id: otp.id } });
    return { ok: false, reason: "too_many_attempts" };
  }

  const match = await bcrypt.compare(code, otp.codeHash);
  if (!match) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "invalid" };
  }

  // Correcto: marcar como usado (un solo uso)
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });
  return { ok: true };
}
