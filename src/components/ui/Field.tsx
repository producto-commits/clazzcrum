"use client";

import { forwardRef } from "react";

// Primitivos de formulario reutilizables con el estilo Clazz.

export const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-foreground/90">
    {children}
  </label>
);

const inputBase =
  "w-full rounded-[10px] border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70 outline-none transition-colors focus:border-brand focus:ring-4 focus:ring-brand/15";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    const { className, ...rest } = props;
    return <input ref={ref} {...rest} className={`${inputBase} ${className ?? ""}`} />;
  },
);

export function Button({
  children,
  loading,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "ghost";
}) {
  // Si el consumidor pasa un ancho (w-*), no forzamos w-full.
  const width = className?.includes("w-") ? "" : "w-full";
  const base = `${width} inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-55 disabled:cursor-not-allowed disabled:active:scale-100`;
  const styles =
    variant === "primary"
      ? "text-brand-fg shadow-[0_6px_18px_-8px_var(--brand)] hover:brightness-110"
      : "border border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-2";
  const style =
    variant === "primary"
      ? { backgroundImage: "linear-gradient(145deg, var(--brand-strong), var(--brand))" }
      : undefined;
  return (
    <button
      {...props}
      style={{ ...style, ...(props.style ?? {}) }}
      disabled={loading || props.disabled}
      className={`${base} ${styles} ${className ?? ""}`}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          aria-hidden
        />
      )}
      {loading ? "Procesando…" : children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  const styles =
    kind === "error"
      ? "border-danger/30 bg-danger/10 text-danger"
      : "border-success/30 bg-success/10 text-success";
  return (
    <div className={`mb-4 rounded-[10px] border px-3 py-2 text-sm ${styles}`} role="alert">
      {children}
    </div>
  );
}
