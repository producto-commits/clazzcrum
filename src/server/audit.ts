import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";

// Registro de auditoría: quién hizo qué acción y cuándo.
export async function writeAudit(params: {
  userId?: string | null;
  action: string; // login | logout | register | create | update | delete | status_change ...
  resource: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        metadata: params.metadata,
        ip: params.ip ?? null,
      },
    });
  } catch (e) {
    // La auditoría no debe romper el flujo principal
    console.error("[audit] no se pudo registrar:", e);
  }
}
