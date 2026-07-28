import { z } from "zod";

const priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const storyStatus = z.enum([
  "BACKLOG",
  "PLANNED",
  "IN_PROGRESS",
  "QA",
  "BLOCKED",
  "DONE",
]);

// ---- Cliente ----
export const clientCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contactName: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal("")).nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export const clientUpdateSchema = clientCreateSchema.partial();

// ---- Proyecto ----
export const projectCreateSchema = z.object({
  clientId: z.string().min(1, "Selecciona un cliente"),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z
    .enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"])
    .optional(),
  startDate: z.coerce.date().optional().nullable(),
  estimatedEnd: z.coerce.date().optional().nullable(),
  actualEnd: z.coerce.date().optional().nullable(),
  sprintWeeks: z.coerce.number().int().min(1).max(12).optional(),
});
export const projectUpdateSchema = projectCreateSchema.partial().omit({ clientId: true });

// ---- Épica ----
export const epicCreateSchema = z.object({
  projectId: z.string().min(1),
  sprintId: z.string().optional().nullable(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: priority.optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
});
export const epicUpdateSchema = epicCreateSchema.partial().omit({ projectId: true });

// ---- Historia de usuario ----
export const storyCreateSchema = z.object({
  projectId: z.string().min(1),
  epicId: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(8000).optional().nullable(),
  observation: z.string().trim().max(4000).optional().nullable(),
  asRole: z.string().trim().max(160).optional().nullable(),
  iWant: z.string().trim().max(500).optional().nullable(),
  soThat: z.string().trim().max(500).optional().nullable(),
  priority: priority.optional(),
  status: storyStatus.optional(),
  storyPoints: z.coerce.number().int().min(0).max(999).optional().nullable(),
  estimateHours: z.coerce.number().min(0).max(9999).optional().nullable(),
  spentHours: z.coerce.number().min(0).max(9999).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  assigneeIds: z.array(z.string()).max(20).optional(),
  startDate: z.coerce.date().optional().nullable(),
  estimatedEnd: z.coerce.date().optional().nullable(),
  actualEnd: z.coerce.date().optional().nullable(),
  completionEvidence: z.string().trim().max(4000).optional().nullable(),
  blockReason: z.string().trim().max(1000).optional().nullable(),
});
export const storyUpdateSchema = storyCreateSchema.partial().omit({ projectId: true });

// ---- Tarea ----
export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(240),
  assigneeId: z.string().optional().nullable(),
  estimateHours: z.coerce.number().min(0).max(9999).optional().nullable(),
});
export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  done: z.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
  estimateHours: z.coerce.number().min(0).max(9999).optional().nullable(),
  spentHours: z.coerce.number().min(0).max(9999).optional(),
});

// ---- Criterio de aceptación ----
export const criterionCreateSchema = z.object({
  text: z.string().trim().min(1).max(500),
});
export const criterionUpdateSchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  done: z.boolean().optional(),
});

// ---- Comentario ----
export const commentCreateSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

// ---- Sprint ----
// Fechas opcionales: el motor calcula el rango real. Si no vienen, la API
// las rellena a partir de la fecha de inicio del proyecto.
export const sprintCreateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  goal: z.string().trim().max(1000).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  capacity: z.coerce.number().int().min(0).max(9999).optional().nullable(),
});
export const sprintUpdateSchema = sprintCreateSchema.partial().omit({ projectId: true });
