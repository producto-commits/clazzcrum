import nodemailer, { type Transporter } from "nodemailer";

// Servicio de correo. Si no hay credenciales SMTP configuradas (MAIL_HOST vacío),
// se usa un modo de desarrollo que imprime el correo en consola — así se puede
// probar el flujo de OTP completo sin credenciales reales.

let transporter: Transporter | null = null;

function isConfigured(): boolean {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_USER);
}

function getTransporter(): Transporter | null {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT ?? 587),
      secure: Number(process.env.MAIL_PORT ?? 587) === 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }
  return transporter;
}

type MailInput = { to: string; subject: string; html: string; text?: string };

export async function sendMail({ to, subject, html, text }: MailInput): Promise<void> {
  const from = process.env.MAIL_FROM ?? "Clazz <no-reply@clazz.local>";
  const t = getTransporter();

  if (!t) {
    // Modo desarrollo: imprimir en consola
    console.log("\n📧 [correo · modo dev — sin SMTP configurado]");
    console.log(`   Para: ${to}`);
    console.log(`   Asunto: ${subject}`);
    console.log(`   ${text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}\n`);
    return;
  }

  await t.sendMail({ from, to, subject, html, text });
}

const brandWrap = (title: string, bodyHtml: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
    <div style="background:#4f46e5;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px;">Clazz</div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px 20px;">
      <h2 style="margin:0 0 12px;font-size:18px;">${title}</h2>
      ${bodyHtml}
    </div>
  </div>`;

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "verify" | "reset",
): Promise<void> {
  const title =
    purpose === "verify" ? "Verifica tu cuenta" : "Recupera tu contraseña";
  const intro =
    purpose === "verify"
      ? "Usa este código para verificar tu cuenta:"
      : "Usa este código para restablecer tu contraseña:";
  const html = brandWrap(
    title,
    `<p style="margin:0 0 16px;">${intro}</p>
     <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f1f5f9;border-radius:8px;padding:16px;text-align:center;">${code}</div>
     <p style="margin:16px 0 0;color:#64748b;font-size:13px;">El código vence en 15 minutos. Si no lo solicitaste, ignora este correo.</p>`,
  );
  await sendMail({
    to,
    subject: `Clazz — ${title} (${code})`,
    html,
    text: `${intro} ${code} (vence en 15 minutos)`,
  });
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const html = brandWrap(
    `¡Bienvenido, ${name}!`,
    `<p>Tu cuenta en Clazz quedó verificada. Ya puedes iniciar sesión.</p>`,
  );
  await sendMail({ to, subject: "Clazz — Bienvenido", html, text: `Bienvenido ${name}` });
}
