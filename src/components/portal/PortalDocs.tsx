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
  const [tab, setTab] = useState<"pending" | "approved">("pending");

  useEffect(() => {
    apiGet<Doc[]>("/api/portal/design-docs")
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  const pending = docs.filter((d) => d.status === "SENT");
  const approved = docs.filter((d) => d.status === "APPROVED");
  const shown = tab === "pending" ? pending : approved;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mis aprobaciones</h1>
      <p className="mb-4 text-sm text-muted">Revisa cada documento enviado, apruébalo o deja un comentario para el equipo.</p>

      {/* Pestañas Por aprobar / Aprobados */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["pending", `Por aprobar (${pending.length})`],
            ["approved", `Aprobados (${approved.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
              tab === key ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonCards />
      ) : shown.length === 0 ? (
        <EmptyState
          title={tab === "pending" ? "Nada pendiente por aprobar" : "Aún no has aprobado documentos"}
          description={
            tab === "pending"
              ? "Cuando el equipo de Clazz te envíe un documento de diseño, aparecerá aquí para tu revisión."
              : "Los documentos que apruebes quedarán guardados aquí."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map((d) => (
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
