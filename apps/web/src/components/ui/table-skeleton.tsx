import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const COL_WIDTHS = ['w-40', 'w-28', 'w-24', 'w-20', 'w-32'];

/** Skeleton mirror of a list page (toolbar strip + table or card grid) while data loads. */
export function TableSkeleton({
  variant = 'table',
  rows = 6,
  columns = 5,
  toolbar = true,
  className,
}: {
  variant?: 'table' | 'grid';
  rows?: number;
  columns?: number;
  toolbar?: boolean;
  className?: string;
}) {
  if (variant === 'grid') {
    return (
      <div
        aria-busy="true"
        aria-label="Loading content"
        className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-busy="true" aria-label="Loading content" className={cn('p-4', className)}>
      {toolbar ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="ml-auto h-9 w-24 rounded-lg" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="flex items-center gap-4 border-b border-border/60 bg-muted/30 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className={cn('h-3.5 rounded', COL_WIDTHS[i % COL_WIDTHS.length])} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 border-b border-border/40 px-4 py-3.5 last:border-0"
          >
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn('h-3.5 rounded', COL_WIDTHS[(i + r) % COL_WIDTHS.length])}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
