import { prisma } from "@/server/db";
import { verifyOtp } from "@/server/auth/otp";
import { issueTokenPair } from "@/server/auth/tokens";
import { setAuthCookies } from "@/server/auth/session";
import { sendWelcomeEmail } from "@/server/mail/mailer";
import { otpSchema } from "@/server/validation/auth";
import { writeAudit } from "@/server/audit";
import { ok, fail, clientIp } from "@/server/http";

const REASONS: Record<string, string> = {
  no_code: "No hay un código activo. Solicita uno nuevo.",
  expired: "El código venció. Solicita uno nuevo.",
  too_many_attempts: "Demasiados intentos. Solicita un código nuevo.",
  invalid: "Código incorrecto.",
};

// POST /api/auth/verify-otp — verifica el correo y deja la sesión iniciada.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = otpSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }
  const { email, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return fail("Cuenta no encontrada", 404);
  if (user.emailVerifiedAt) return ok({ ok: true, alreadyVerified: true });

  const result = await verifyOtp(user.id, "VERIFY_EMAIL", code);
  if (!result.ok) {
    return fail(REASONS[result.reason] ?? "Código inválido", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });

  await sendWelcomeEmail(user.email, user.name);

  const { accessToken, refreshToken } = await issueTokenPair(user.id);
  await setAuthCookies(accessToken, refreshToken);

  await writeAudit({
    userId: user.id,
    action: "verify_email",
    resource: "user",
    resourceId: user.id,
    ip: clientIp(req),
  });

  return ok({ ok: true, verified: true });
}
