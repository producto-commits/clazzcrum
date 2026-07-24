import { LogoMark, Wordmark } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca (solo escritorio) */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{ backgroundImage: "linear-gradient(150deg, var(--brand-strong), var(--brand))" }}>
        <div className="relative z-10">
          <span className="flex items-center gap-2.5 text-white">
            <LogoMark size={34} />
            <span className="font-display text-xl font-semibold">Clazz</span>
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight text-white">
            Entrega ágil,<br />soporte impecable.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">
            Proyectos, sprints y casos de soporte en un solo lugar. Del backlog al cierre,
            con el cliente al tanto en cada paso.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm text-white/85">
            {["Tablero Kanban y sprints", "Mesa de servicio con SLA", "Documentos de diseño y métricas"].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-white/50">© Clazz</div>

        {/* Motivo de marca decorativo (arco + triángulo) */}
        <svg className="absolute -right-16 -bottom-16 h-96 w-96 text-white/10" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M17 6.2A7.2 7.2 0 1 0 17 17.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12 7.6l3.2 5.2H8.8L12 7.6z" fill="currentColor" />
        </svg>
      </aside>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rise">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <Wordmark size={38} />
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
