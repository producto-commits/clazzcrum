"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { ProjectStructure } from "@/components/scrum/ProjectStructure";

type Project = { id: string; name: string; status: string; client: { id: string; name: string } };

// Vista del proyecto para el CLIENTE: solo avance de proyecto y sprints
// (ProjectStructure en modo clientView, sin historias ni edición).
export function PortalProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Project>(`/api/projects/${projectId}`)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="text-sm text-muted">Cargando proyecto…</p>;
  if (!project) return <p className="text-sm text-muted">No se encontró el proyecto.</p>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/portal/proyectos" className="text-xs text-muted hover:underline">
          ← Mis proyectos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted">Avance del proyecto y de sus hitos</p>
      </div>

      <ProjectStructure
        projectId={projectId}
        canEdit={false}
        canPlan={false}
        reloadKey={0}
        onOpenStory={() => {}}
        onAddSprint={() => {}}
        onChanged={() => {}}
        clientView
      />
    </div>
  );
}
