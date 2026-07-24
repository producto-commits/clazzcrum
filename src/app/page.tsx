import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";

// Raíz: enruta según sesión y rol (staff → panel; cliente → portal).
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  const staff =
    session.roles.includes("admin") ||
    session.roles.includes("tech_lead") ||
    session.roles.includes("developer");
  redirect(staff ? "/dashboard" : "/portal");
}
