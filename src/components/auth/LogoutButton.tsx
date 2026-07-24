"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      title="Cerrar sesión"
      aria-label="Cerrar sesión"
      className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-surface px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 4h3a1 1 0 011 1v14a1 1 0 01-1 1h-3M10 17l5-5-5-5M15 12H3" />
      </svg>
      <span className="hidden sm:inline">Salir</span>
    </button>
  );
}
