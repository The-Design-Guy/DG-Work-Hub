import { cn } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-elevated/70", className)} aria-hidden />;
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="card-grid" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-[var(--radius-card)]" />
      ))}
    </div>
  );
}
