import { prisma } from "@/server/db";
import { verifyOtp } from "@/server/auth/otp";
import { hashPassword } from "@/server/auth/password";
import { resetPasswordSchema } from "@/server/validation/auth";
import { writeAudit } from "@/server/audit";
import { ok, fail, clientIp } from "@/server/http";

const REASONS: Record<string, string> = {
  no_code: "No hay un código activo. Solicita uno nuevo.",
  expired: "El código venció. Solicita uno nuevo.",
  too_many_attempts: "Demasiados intentos. Solicita un código nuevo.",
  invalid: "Código incorrecto.",
};

// POST /api/auth/reset-password — cambia la contraseña usando el OTP.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }
  const { email, code, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return fail("No se pudo restablecer la contraseña", 400);

  const result = await verifyOtp(user.id, "RESET_PASSWORD", code);
  if (!result.ok) return fail(REASONS[result.reason] ?? "Código inválido", 400);

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Revocar todas las sesiones activas por seguridad
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await writeAudit({
    userId: user.id,
    action: "reset_password",
    resource: "user",
    resourceId: user.id,
    ip: clientIp(req),
  });

  return ok({ ok: true });
}
