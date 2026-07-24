import { prisma } from "@/server/db";
import { issueOtp } from "@/server/auth/otp";
import { sendOtpEmail } from "@/server/mail/mailer";
import { emailOnlySchema } from "@/server/validation/auth";
import { ok, fail } from "@/server/http";

// POST /api/auth/resend-otp — reenvía el código de verificación (respeta cooldown).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = emailOnlySchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Respuesta genérica para no revelar si el correo existe
  if (!user || user.emailVerifiedAt) {
    return ok({ ok: true });
  }

  const issued = await issueOtp(user.id, "VERIFY_EMAIL");
  if (!issued.ok) {
    return fail(`Espera ${issued.retryAfter}s para reenviar`, 429, {
      retryAfter: issued.retryAfter,
    });
  }
  await sendOtpEmail(email, issued.code, "verify");
  return ok({ ok: true });
}
