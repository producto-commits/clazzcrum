import { prisma } from "@/server/db";
import type { SessionPayload } from "./jwt";

export type AccessScope = {
  isStaff: boolean;
  userId: string;
  // Si el usuario es cliente-final, id de SU cliente (para aislar datos). null = staff.
  clientId: string | null;
  // Proyectos que el usuario-cliente puede ver. null = todos los de su cliente.
  projectIds: string[] | null;
  // Desarrollador: solo ve el trabajo asignado a él. Admin/líder ven todo.
  assignedOnly: boolean;
};

// Determina el alcance de datos del usuario.
// - admin / líder técnico: ven todo.
// - desarrollador: staff, pero solo lo que tiene asignado.
// - cliente: solo su cliente (y opcionalmente ciertos proyectos).
export async function resolveScope(session: SessionPayload): Promise<AccessScope> {
  const roles = session.roles;
  const isAdminOrLead = roles.includes("admin") || roles.includes("tech_lead");
  const isDeveloper = roles.includes("developer") && !isAdminOrLead;

  if (isAdminOrLead) {
    return { isStaff: true, userId: session.userId, clientId: null, projectIds: null, assignedOnly: false };
  }
  if (isDeveloper) {
    return { isStaff: true, userId: session.userId, clientId: null, projectIds: null, assignedOnly: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { clientId: true, projectAccess: { select: { projectId: true } } },
  });
  const projectIds = user?.projectAccess.map((p) => p.projectId) ?? [];
  return {
    isStaff: false,
    userId: session.userId,
    clientId: user?.clientId ?? "__none__",
    projectIds: projectIds.length ? projectIds : null,
    assignedOnly: false,
  };
}
