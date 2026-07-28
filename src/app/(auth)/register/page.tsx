import { redirect } from "next/navigation";

// Auto-registro deshabilitado: solo los administradores crean cuentas
// desde /admin/users. Cualquier acceso a /register vuelve al login.
export default function RegisterPage() {
  redirect("/login");
}
