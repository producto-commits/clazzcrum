import { prisma } from "@/server/db";
import { issueOtp } from "@/server/auth/otp";
import { sendOtpEmail } from "@/server/mail/mailer";
import { emailOnlySchema } from "@/server/validation/auth";
import { ok, fail } from "@/server/http";

// POST /api/auth/forgot-password — envía un OTP para restablecer la contraseña.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = emailOnlySchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Respuesta genérica: no revelar si el correo existe
  if (user && user.isActive) {
    const issued = await issueOtp(user.id, "RESET_PASSWORD");
    if (issued.ok) await sendOtpEmail(email, issued.code, "reset");
  }
  return ok({ ok: true });
}
