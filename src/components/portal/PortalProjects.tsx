"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Project = {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string };
  _count: { stories: number; sprints: number; epics: number };
};

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planeación",
  ACTIVE: "Activo",
  ON_HOLD: "En pausa",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export function PortalProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Project[]>("/api/projects")
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mis proyectos</h1>
      </div>
      <p className="mb-6 text-sm text-muted">Consulta el avance de cada proyecto y de sus sprints.</p>

      {loading ? (
        <SkeletonCards />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Aún no hay proyectos"
          description="Cuando tu equipo de Clazz active un proyecto, aparecerá aquí con su avance."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/portal/proyectos/${p.id}`}
              className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted">
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
              <div className="mt-3 flex gap-2 text-xs text-muted">
                <span className="rounded-full bg-background px-2 py-0.5">{p._count.sprints} sprints</span>
                <span className="rounded-full bg-background px-2 py-0.5">{p._count.stories} historias</span>
              </div>
              <div className="mt-3 text-sm font-medium text-brand">Ver avance →</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
