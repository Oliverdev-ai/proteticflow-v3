import { cn } from '../../lib/utils';

export function ChartSkeleton({ className }: { className?: string | undefined }) {
  return (
    <div className={cn('h-[220px] w-full rounded-2xl border border-border bg-card p-5', className)}>
      <div className="mb-6 h-4 w-32 animate-pulse rounded-pill bg-muted" />
      <div className="flex h-[160px] items-end gap-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="min-h-8 flex-1 animate-pulse rounded-t-md bg-muted"
            style={{ height: `${36 + (index % 4) * 16}%` }}
          />
        ))}
      </div>
    </div>
  );
}
