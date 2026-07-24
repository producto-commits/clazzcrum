import { z } from "zod";

const priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const ticketStatus = z.enum([
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_CLIENT",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
]);

export const ticketCreateSchema = z.object({
  // clientId es opcional: para el rol cliente se fuerza al suyo en el backend.
  clientId: z.string().optional().nullable(),
  subject: z.string().trim().min(3, "El asunto es muy corto").max(200),
  description: z.string().trim().min(3, "Describe el caso").max(8000),
  priority: priority.optional(),
  categoryId: z.string().optional().nullable(),
});

export const ticketUpdateSchema = z.object({
  status: ticketStatus.optional(),
  priority: priority.optional(),
  categoryId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

export const ticketMessageSchema = z.object({
  body: z.string().trim().min(1).max(8000),
  visibility: z.enum(["PUBLIC", "INTERNAL"]).optional(),
});

export const csatSchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
});

export const convertSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
});

export const slaUpdateSchema = z.object({
  firstResponseMins: z.coerce.number().int().min(1).max(100000),
  resolutionMins: z.coerce.number().int().min(1).max(1000000),
});
