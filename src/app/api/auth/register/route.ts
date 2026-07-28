import { fail } from "@/server/http";

// POST /api/auth/register — DESHABILITADO. Solo los administradores crean
// cuentas desde /admin/users. Ver src/app/(auth)/register/page.tsx (redirige a /login).
export async function POST() {
  return fail(
    "El auto-registro está deshabilitado. Solicita a un administrador que cree tu cuenta.",
    403,
  );
}
