// Gráficos SVG ligeros, temáticos con las variables de marca. Sin dependencias.

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-brand/40 bg-brand/5" : "border-border bg-surface"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// Barras horizontales con etiqueta y valor (estados de historias/tickets).
export function StatusBars({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-sm">
          <span className="w-40 shrink-0 truncate text-muted">{d.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-background">
            <div
              className="h-full rounded"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color, minWidth: d.value ? 4 : 0 }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// Barras verticales agrupadas (velocity: comprometido vs completado).
export function VelocityChart({
  data,
}: {
  data: { name: string; committed: number; completed: number }[];
}) {
  if (data.length === 0) return <p className="text-sm text-muted">Sin hitos todavía.</p>;
  const max = Math.max(1, ...data.map((d) => Math.max(d.committed, d.completed)));
  const W = Math.max(280, data.length * 80);
  const H = 160;
  const pad = 24;
  const bw = (W - pad * 2) / data.length;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 24}`} width={W} height={H + 24} role="img">
        {data.map((d, i) => {
          const x = pad + i * bw;
          const ch = (d.committed / max) * H;
          const dh = (d.completed / max) * H;
          return (
            <g key={d.name}>
              <rect x={x + bw * 0.15} y={H - ch} width={bw * 0.3} height={ch} rx={2} fill="var(--border)" />
              <rect x={x + bw * 0.5} y={H - dh} width={bw * 0.3} height={dh} rx={2} fill="var(--brand)" />
              <text x={x + bw * 0.5} y={H + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {d.name.length > 8 ? d.name.slice(0, 7) + "…" : d.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--border)" }} /> Comprometido
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--brand)" }} /> Completado
        </span>
      </div>
    </div>
  );
}

// Burndown: línea ideal (punteada) vs restante (sólida).
export function BurndownChart({
  days,
}: {
  days: { date: string; ideal: number; remaining: number }[];
}) {
  if (days.length === 0) return <p className="text-sm text-muted">Sin datos.</p>;
  const W = 480;
  const H = 160;
  const pad = 28;
  const max = Math.max(1, ...days.map((d) => Math.max(d.ideal, d.remaining)));
  const n = days.length;
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, n - 1);
  const y = (v: number) => pad / 2 + (1 - v / max) * (H - pad);

  const line = (key: "ideal" | "remaining") =>
    days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key])}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" preserveAspectRatio="xMidYMid meet">
        <line x1={pad} y1={H - pad / 2} x2={W - pad} y2={H - pad / 2} stroke="var(--border)" />
        <path d={line("ideal")} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" />
        <path d={line("remaining")} fill="none" stroke="var(--brand)" strokeWidth={2} />
        {days.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.remaining)} r={2.5} fill="var(--brand)" />
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4" style={{ background: "var(--muted)" }} /> Ideal
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4" style={{ background: "var(--brand)" }} /> Restante
        </span>
      </div>
    </div>
  );
}
