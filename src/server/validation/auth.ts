import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  code: z.string().trim().regex(/^\d{6}$/, "El código son 6 dígitos"),
});

export const emailOnlySchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  code: z.string().trim().regex(/^\d{6}$/, "El código son 6 dígitos"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
