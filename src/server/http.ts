import { NextResponse } from "next/server";
import type { z } from "zod";

// Parsea y valida el cuerpo JSON con un esquema zod.
// Devuelve { data } o un NextResponse de error (422) listo para retornar.
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | NextResponse> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 422 },
    );
  }
  return { data: parsed.data };
}

// Respuestas JSON uniformes para la API.
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// Obtiene la IP del cliente desde las cabeceras habituales de proxy.
export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
