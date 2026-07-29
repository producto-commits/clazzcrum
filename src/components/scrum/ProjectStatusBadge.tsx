"use client";

import { useEffect, useRef, useState } from "react";
import { apiSend } from "@/lib/api";

export const PROJECT_STATUS_META: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  PLANNING: {
    label: "Planeación",
    className: "bg-info/15 text-info border-info/30",
    dot: "bg-info",
  },
  ACTIVE: {
    label: "Activo",
    className: "bg-brand/15 text-brand border-brand/40",
    dot: "bg-brand",
  },
  ON_HOLD: {
    label: "En pausa",
    className: "bg-warning/15 text-warning border-warning/30",
    dot: "bg-warning",
  },
  COMPLETED: {
    label: "Completado",
    className: "bg-accent-2/15 text-accent-2 border-accent-2/30",
    dot: "bg-accent-2",
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-danger/15 text-danger border-danger/30",
    dot: "bg-danger",
  },
};

const ORDER = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

// Píldora de estado del proyecto. Si `editable=true`, al hacer clic abre un
// pequeño menú para cambiar de estado sin salir de la vista.
export function ProjectStatusBadge({
  projectId,
  status,
  editable = false,
  size = "sm",
  onChanged,
}: {
  projectId: string;
  status: string;
  editable?: boolean;
  size?: "sm" | "md";
  onChanged?: (newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = PROJECT_STATUS_META[status] ?? {
    label: status,
    className: "bg-surface-2 text-muted border-border",
    dot: "bg-muted",
  };

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function change(next: string) {
    if (next === status) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await apiSend(`/api/projects/${projectId}`, "PATCH", { status: next });
      onChanged?.(next);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  const pill = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${meta.className} ${pad}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
      {editable && <span className="text-[9px] opacity-60">▾</span>}
    </span>
  );

  if (!editable) return pill;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={busy}
        title="Cambiar estado"
        className="cursor-pointer"
      >
        {pill}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-xl border border-border-strong bg-surface p-1 shadow-[var(--shadow-md)]">
          {ORDER.map((s) => {
            const m = PROJECT_STATUS_META[s];
            const isCurrent = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); change(s); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-background ${
                  isCurrent ? "text-brand" : "text-foreground"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                <span className="flex-1">{m.label}</span>
                {isCurrent && <span className="text-xs text-brand">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
