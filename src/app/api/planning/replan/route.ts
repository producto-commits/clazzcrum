import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guard";
import { parseBody, ok, fail } from "@/server/http";
import { replanProject } from "@/server/services/planning";

const schema = z.object({ projectId: z.string().min(1) });

// POST /api/planning/replan — recalcula todo el cronograma de un proyecto.
export async function POST(req: Request) {
  const auth = await requirePermission("edit", "project");
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, schema);
  if (parsed instanceof NextResponse) return parsed;
  try {
    const result = await replanProject(parsed.data.projectId);
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo replanificar", 400);
  }
}
