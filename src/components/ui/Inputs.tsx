"use client";

const base =
  "w-full rounded-[10px] border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70 outline-none transition-colors focus:border-brand focus:ring-4 focus:ring-brand/15";

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${base} min-h-[80px] ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} ${props.className ?? ""}`} />;
}

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const PRIORITY_CLASSES: Record<string, string> = {
  LOW: "bg-slate-500/15 text-slate-400",
  MEDIUM: "bg-sky-500/15 text-sky-400",
  HIGH: "bg-amber-500/15 text-amber-500",
  CRITICAL: "bg-red-500/15 text-red-400",
};
