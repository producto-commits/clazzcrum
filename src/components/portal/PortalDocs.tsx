"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Doc = {
  id: string;
  title: string;
  status: "SENT" | "APPROVED";
  currentVersion: number;
  approvedAt: string | null;
  project: { id: string; name: string };
  _count: { comments: number };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  SENT: { label: "Pendiente de tu revisión", cls: "bg-info/15 text-info" },
  APPROVED: { label: "Aprobado", cls: "bg-success/15 text-success" },
};

export function PortalDocs() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Doc[]>("/api/portal/design-docs")
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Documentos de diseño</h1>
      <p className="mb-6 text-sm text-muted">Revisa el documento, apruébalo o deja un comentario para el equipo.</p>

      {loading ? (
        <SkeletonCards />
      ) : docs.length === 0 ? (
        <EmptyState
          title="Sin documentos por ahora"
          description="Cuando el equipo de Clazz te envíe un documento de diseño, aparecerá aquí para tu revisión."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <Link
              key={d.id}
              href={`/portal/documentos/${d.id}`}
              className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{d.title}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[d.status].cls}`}>
                  {STATUS[d.status].label}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted">{d.project.name}</div>
              <div className="mt-3 flex gap-2 text-xs text-muted">
                <span className="rounded-full bg-background px-2 py-0.5">Versión {d.currentVersion}</span>
                {d._count.comments > 0 && (
                  <span className="rounded-full bg-background px-2 py-0.5">💬 {d._count.comments}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
