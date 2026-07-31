import { prisma } from "@/server/db";

// Devuelve el "encargado" del proyecto: el desarrollador/líder técnico con
// mayor % de dedicación en ProjectAssignment. Si no hay a nadie asignado,
// devuelve null y el llamador debe decidir un fallback (p. ej. quien creó).
export async function resolveProjectOwner(projectId: string): Promise<string | null> {
  const owner = await prisma.projectAssignment.findFirst({
    where: {
      projectId,
      user: {
        isActive: true,
        roles: { some: { role: { key: { in: ["developer", "tech_lead"] } } } },
      },
    },
    orderBy: [{ dedicationPct: "desc" }, { priority: "asc" }],
    select: { userId: true },
  });
  return owner?.userId ?? null;
}
