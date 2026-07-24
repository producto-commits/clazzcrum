import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/server/auth/jwt";
import { ACCESS_COOKIE } from "@/server/auth/session";

// Reemplazo de "middleware" en Next 16. Hace comprobaciones optimistas
// (solo lee la cookie, sin tocar BD) para redirigir usuarios.

// Rutas del panel del EQUIPO (staff).
const STAFF_PREFIXES = [
  "/dashboard",
  "/admin",
  "/projects",
  "/clients",
  "/scrum",
  "/service-desk",
  "/discovery",
];
// Rutas del PORTAL del cliente.
const PORTAL_PREFIX = "/portal";
const AUTH_PAGES = ["/login", "/register", "/verify", "/forgot-password", "/reset-password"];

// ¿La sesión es de un cliente-final (no staff)?
function isClientSession(roles: string[]): boolean {
  const staff = roles.includes("admin") || roles.includes("tech_lead") || roles.includes("developer");
  return !staff;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const session = token ? await verifyAccessToken(token) : null;

  const isStaffArea = STAFF_PREFIXES.some((p) => pathname.startsWith(p));
  const isPortalArea = pathname.startsWith(PORTAL_PREFIX);
  const isProtected = isStaffArea || isPortalArea;
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isProtected && !session) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session) {
    const client = isClientSession(session.roles);
    // El cliente no entra al panel del equipo → se va a su portal.
    if (isStaffArea && client) {
      return NextResponse.redirect(new URL("/portal", req.nextUrl));
    }
    // El staff no usa el portal del cliente.
    if (isPortalArea && !client) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    // Ya autenticado en una página de auth → a su inicio según rol.
    if (isAuthPage) {
      return NextResponse.redirect(new URL(client ? "/portal" : "/dashboard", req.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
