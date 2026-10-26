'use client';

import type { AuditLogView } from '@orgwise/types';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  restore: 'Restored',
  import: 'Imported',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  restore: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  import: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

interface Props {
  employeeId: string;
}

export function ActivityTimeline({ employeeId }: Props) {
  const [entries, setEntries] = useState<AuditLogView[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setPage(1);
    setEntries([]);
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ items: AuditLogView[]; total: number }>(
        `/audit?entityType=employee&entityId=${employeeId}&page=${page}&pageSize=10`,
      )
      .then((res) => {
        if (cancelled) return;
        setEntries((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        setHasMore(res.items.length === 10);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, page]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && entries.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            Loading activity…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : (
          <div className="relative space-y-4">
            {/* Vertical timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

            {entries.map((entry) => (
              <div key={entry.id} className="relative flex gap-3">
                <div className="relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[10px] font-bold text-muted-foreground">
                  {ACTION_LABELS[entry.action]?.charAt(0) ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${ACTION_COLORS[entry.action] ?? ''}`}
                    >
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  {entry.actor?.name ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      by <span className="font-medium text-foreground">{entry.actor.name}</span>
                    </p>
                  ) : null}
                  {entry.details &&
                  typeof entry.details === 'object' &&
                  Object.keys(entry.details).length > 0 ? (
                    <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  ) : null}
                </div>
              </div>
            ))}

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
