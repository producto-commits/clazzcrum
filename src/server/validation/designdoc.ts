import { z } from "zod";

export const designDocCreateSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  title: z.string().trim().min(2).max(200),
});

// Las respuestas son un mapa sección → texto.
export const designDocSaveSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  answers: z.record(z.string(), z.string().max(20000)).optional(),
  status: z.enum(["DRAFT", "SENT", "APPROVED"]).optional(),
});

export const designDocVersionSchema = z.object({
  changeNote: z.string().trim().max(500).optional().nullable(),
});
