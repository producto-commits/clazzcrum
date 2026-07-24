import { prisma } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { issueTokenPair } from "@/server/auth/tokens";
import { setAuthCookies } from "@/server/auth/session";
import { issueOtp } from "@/server/auth/otp";
import { sendOtpEmail } from "@/server/mail/mailer";
import { loginSchema } from "@/server/validation/auth";
import { writeAudit } from "@/server/audit";
import { ok, fail, clientIp } from "@/server/http";

// POST /api/auth/login — inicia sesión (JWT en cookies httpOnly).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Mensaje genérico para no revelar si el correo existe
  const invalid = () => fail("Correo o contraseña incorrectos", 401);

  if (!user || !user.isActive) return invalid();
  const passOk = await verifyPassword(password, user.passwordHash);
  if (!passOk) {
    await writeAudit({
      userId: user.id,
      action: "login_failed",
      resource: "user",
      resourceId: user.id,
      ip: clientIp(req),
    });
    return invalid();
  }

  // Cuenta sin verificar: reenviar OTP y pedir verificación
  if (!user.emailVerifiedAt) {
    const issued = await issueOtp(user.id, "VERIFY_EMAIL");
    if (issued.ok) await sendOtpEmail(user.email, issued.code, "verify");
    return fail("Debes verificar tu correo. Te enviamos un código.", 403, {
      needsVerification: true,
      email: user.email,
    });
  }

  const { accessToken, refreshToken } = await issueTokenPair(user.id);
  await setAuthCookies(accessToken, refreshToken);

  await writeAudit({
    userId: user.id,
    action: "login",
    resource: "user",
    resourceId: user.id,
    ip: clientIp(req),
  });

  return ok({ ok: true });
}
