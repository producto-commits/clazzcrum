"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";

type StoryAlert = { id: string; title: string; estimatedEnd: string | null; projectId: string; project: { name: string } };
type TicketAlert = { id: string; number?: number; subject: string; createdAt: string };
type Alerts = { dueToday: StoryAlert[]; overdue: StoryAlert[]; newTickets: TicketAlert[] };

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—";
}

// Marcamos como "leídas" localmente por id. El backend no persiste el estado
// leído/no-leído hoy — es suficiente con el navegador del usuario.
const SEEN_KEY = "clazz.alerts.seen";

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveSeen(seen: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* storage lleno o deshabilitado — no bloqueamos */
  }
}

// Campana de alertas del equipo: vencen hoy, vencidas y tickets nuevos.
// Al abrir el menú, todo lo visible queda como "leído" (el contador se
// resetea) hasta que lleguen alertas nuevas.
export function AlertsBell() {
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => apiGet<Alerts>("/api/alerts").then(setAlerts).catch(() => setAlerts(null));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Podamos el localStorage: mantenemos solo los IDs que siguen apareciendo,
  // para no crecer sin límite cuando alertas viejas desaparecen.
  useEffect(() => {
    if (!alerts) return;
    const active = new Set<string>();
    alerts.overdue.forEach((a) => active.add(a.id));
    alerts.dueToday.forEach((a) => active.add(a.id));
    alerts.newTickets.forEach((t) => active.add(t.id));
    setSeen((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) if (active.has(id)) next.add(id);
      changed = next.size !== prev.size;
      if (!changed) return prev;
      saveSeen(next);
      return next;
    });
  }, [alerts]);

  const activeIds = useMemo(() => {
    if (!alerts) return [] as string[];
    return [
      ...alerts.overdue.map((a) => a.id),
      ...alerts.dueToday.map((a) => a.id),
      ...alerts.newTickets.map((t) => t.id),
    ];
  }, [alerts]);

  const unread = useMemo(
    () => activeIds.filter((id) => !seen.has(id)).length,
    [activeIds, seen],
  );

  const markAllRead = useCallback(() => {
    if (activeIds.length === 0) return;
    setSeen((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of activeIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      saveSeen(next);
      return next;
    });
  }, [activeIds]);

  function toggle() {
    setOpen((wasOpen) => {
      if (!wasOpen) markAllRead(); // se abre → marcar como leídas
      return !wasOpen;
    });
  }

  if (!alerts) return null;
  const count = alerts.dueToday.length + alerts.overdue.length + alerts.newTickets.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        title="Alertas"
        className="relative rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-border-strong bg-surface p-2 shadow-[var(--shadow-md)]">
          {count === 0 && <p className="p-3 text-sm text-muted">Sin alertas por ahora. 🎉</p>}

          {alerts.overdue.length > 0 && (
            <>
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-danger">Vencidas ({alerts.overdue.length})</p>
              {alerts.overdue.map((a) => (
                <Link key={a.id} href={`/projects/${a.projectId}`} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-background">
                  <span className="line-clamp-1">{a.title}</span>
                  <span className="text-[11px] text-muted">{a.project.name} · venció {fmt(a.estimatedEnd)}</span>
                </Link>
              ))}
            </>
          )}

          {alerts.dueToday.length > 0 && (
            <>
              <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-warning">Vencen hoy ({alerts.dueToday.length})</p>
              {alerts.dueToday.map((a) => (
                <Link key={a.id} href={`/projects/${a.projectId}`} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-background">
                  <span className="line-clamp-1">{a.title}</span>
                  <span className="text-[11px] text-muted">{a.project.name}</span>
                </Link>
              ))}
            </>
          )}

          {alerts.newTickets.length > 0 && (
            <>
              <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-info">Tickets nuevos ({alerts.newTickets.length})</p>
              {alerts.newTickets.map((t) => (
                <Link key={t.id} href={`/service-desk/${t.id}`} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-background">
                  <span className="line-clamp-1">
                    {t.number != null && <span className="font-mono text-muted">#{String(t.number).padStart(3, "0")} </span>}
                    {t.subject}
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
