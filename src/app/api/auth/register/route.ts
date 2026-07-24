import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { issueOtp } from "@/server/auth/otp";
import { sendOtpEmail } from "@/server/mail/mailer";
import { registerSchema } from "@/server/validation/auth";
import { writeAudit } from "@/server/audit";
import { ok, fail, clientIp } from "@/server/http";

// POST /api/auth/register — crea la cuenta (sin verificar) y envía OTP al correo.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return fail("Ya existe una cuenta con este correo", 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  // Rol por defecto para auto-registro: cliente (portal de cliente-final).
  const clientRole = await prisma.role.findUnique({ where: { key: "client" } });
  if (clientRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: clientRole.id },
    });
  }

  const issued = await issueOtp(user.id, "VERIFY_EMAIL");
  if (issued.ok) {
    await sendOtpEmail(email, issued.code, "verify");
  }

  await writeAudit({
    userId: user.id,
    action: "register",
    resource: "user",
    resourceId: user.id,
    ip: clientIp(req),
  });

  return ok({ ok: true, needsVerification: true, email }, { status: 201 });
}
