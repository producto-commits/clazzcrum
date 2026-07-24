"use client";

import { useState } from "react";

// Marca Clazz Digital.
// Usa el logo oficial si existe en /clazz-logo.png; si no, cae a un
// monograma SVG (círculo verde con arco "C" + triángulo).
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const [useFallback, setUseFallback] = useState(false);

  if (!useFallback) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/clazz-logo.png"
        alt="Clazz Digital"
        width={size}
        height={size}
        onError={() => setUseFallback(true)}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(150deg, var(--brand), var(--brand-strong))",
        boxShadow: "0 6px 16px -6px color-mix(in oklab, var(--brand) 55%, transparent)",
      }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M17 6.2A7.2 7.2 0 1 0 17 17.8" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M12 7.6l3.2 5.2H8.8L12 7.6z" fill="#fff" />
      </svg>
    </span>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight">Clazz</span>
        <span className="text-[9px] font-medium uppercase tracking-[0.28em] text-muted">Digital</span>
      </span>
    </span>
  );
}
