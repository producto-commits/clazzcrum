import { z } from "zod";

export const adminUserCreateSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresa el nombre").max(80),
  lastName: z.string().trim().min(1, "Ingresa el apellido").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
  roleKey: z.enum(["admin", "tech_lead", "developer", "client"]),
  jobTitle: z.string().trim().max(120).optional().nullable(),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().toLowerCase().email("Correo inválido").optional(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  roleKey: z.enum(["admin", "tech_lead", "developer", "client"]).optional(),
  isActive: z.boolean().optional(),
  // Motor de planificación: capacidad y dedicación por proyecto.
  dailyHours: z.coerce.number().min(0.5).max(24).optional(),
  weeklyHours: z.coerce.number().min(1).max(120).optional().nullable(),
  assignments: z
    .array(
      z.object({
        projectId: z.string().min(1),
        dedicationPct: z.coerce.number().int().min(1).max(100),
        priority: z.coerce.number().int().min(1).max(99).optional(),
      }),
    )
    .max(30)
    .optional(),
  // Contraseña opcional: solo si se quiere restablecer. Vacío = sin cambio.
  password: z.string().min(8).max(128).optional().or(z.literal("")),
  // Proyectos que el usuario-cliente puede ver (vacío = todos los de su cliente).
  projectIds: z.array(z.string()).optional(),
});
