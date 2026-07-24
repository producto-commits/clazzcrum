export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

// Rejilla de tarjetas fantasma (listas de proyectos/clientes/docs).
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
          <Skeleton className="mt-4 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Filas fantasma (tablas de casos, etc.).
export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 last:border-0">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
