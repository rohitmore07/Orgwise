'use client';

import type { AuditAction, AuditEntityType, AuditLogView, Paginated } from '@orgwise/types';
import { ExternalLink, RefreshCw, Search, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { api } from '@/lib/api';
import { formatDateTime, formatRelative, formatTime } from '@/lib/format';

const PAGE_SIZE = 25;

/** How often the feed silently re-polls while the tab is visible. */
const REFRESH_INTERVAL_MS = 30_000;

/** Human labels for each audited action. */
const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  restore: 'Restored',
  role_change: 'Role changed',
  import: 'Import',
};

/** Badge tone per action — destructive and restore stand out. */
const ACTION_VARIANTS: Record<AuditAction, NonNullable<BadgeProps['variant']>> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  restore: 'default',
  role_change: 'warning',
  import: 'secondary',
};

/** Human labels for each audited entity type. */
const ENTITY_LABELS: Record<AuditEntityType, string> = {
  user: 'User',
  department: 'Department',
  team: 'Team',
  employee: 'Employee',
  import: 'Import',
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [entityType, setEntityType] = useState<AuditEntityType | ''>('');

  const [result, setResult] = useState<Paginated<AuditLogView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  /** True when the last automatic refresh failed but data is still shown. */
  const [stale, setStale] = useState(false);
  // Ref mirrors for the auto-refresh timer, mutated directly inside `load` so the in-flight guard is airtight (no…
  // post-render mirror lag): skip ticks while a fetch is in flight, and only surface errors when there is nothing…
  const loadingRef = useRef(false);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);
      if (action) params.set('action', action);
      if (entityType) params.set('entityType', entityType);
      // noCache: the 30s live poll must always hit the server, never a cached page.
      const data = await api.get<Paginated<AuditLogView>>(`/audit-logs?${params.toString()}`, {
        noCache: true,
      });
      setResult(data);
      hasDataRef.current = true;
      setStale(false);
      setLastUpdated(new Date());
    } catch (err) {
      if (hasDataRef.current) {
        setStale(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [page, search, action, entityType]);

  useEffect(() => {
    void load();
  }, [load]);
  // Live polling: refresh every 30s while the tab is visible, and refresh
  // immediately when the user returns to a backgrounded tab.
  useEffect(() => {
    const tick = () => {
      if (loadingRef.current || document.visibilityState !== 'visible') return;
      void load();
    };
    const intervalId = window.setInterval(tick, REFRESH_INTERVAL_MS);
    // `tick` self-guards on visibility, so one listener handles both the
    // refresh-on-return and the no-op-while-hidden cases.
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, action, entityType]);

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Audit Log"
        description="A chronological, immutable trail of state-changing operations — who did what, to which record, and when."
        actions={
          <div className="flex items-center gap-2.5">
            {stale ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                title="The last automatic refresh failed — showing earlier data. Retrying shortly."
              >
                <RefreshCw className="size-3" aria-hidden /> Stale
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            )}
            {lastUpdated ? (
              <span
                className="hidden text-xs text-muted-foreground sm:inline"
                title={`Last refreshed ${formatTime(lastUpdated)}`}
              >
                Updated {formatRelative(lastUpdated.toISOString())}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh audit log now"
            >
              <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search actor name, email, or record id…"
                className="pl-9"
                aria-label="Search audit log"
              />
            </div>
            <Select
              value={action}
              onChange={(e) => setAction(e.target.value as AuditAction | '')}
              placeholder="All actions"
              aria-label="Filter by action"
              options={(Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => ({
                value: a,
                label: ACTION_LABELS[a],
              }))}
            />
            <Select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as AuditEntityType | '')}
              placeholder="All record types"
              aria-label="Filter by record type"
              options={(Object.keys(ENTITY_LABELS) as AuditEntityType[]).map((t) => ({
                value: t,
                label: ENTITY_LABELS[t],
              }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={7} />
          ) : error ? (
            <ErrorState description={error} onRetry={() => void load()} />
          ) : result && result.items.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit entries found"
              description={
                search || action || entityType
                  ? 'Try adjusting your filters or search query.'
                  : 'State-changing operations will appear here as they happen.'
              }
            />
          ) : result ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Record</TableHead>
                    <TableHead className="hidden md:table-cell">Entity Id</TableHead>
                    <TableHead className="hidden lg:table-cell">Details</TableHead>
                    <TableHead className="hidden xl:table-cell">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell
                        className="whitespace-nowrap text-sm text-muted-foreground"
                        title={formatDateTime(log.createdAt)}
                      >
                        {formatRelative(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">
                          {log.actor?.name ?? 'System'}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {log.actor?.email ?? '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANTS[log.action]}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ENTITY_LABELS[log.entityType] ?? log.entityType}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                        {log.entityId && log.entityType === 'employee' ? (
                          <Link
                            href={`/employees/${log.entityId}`}
                            title={`View employee ${log.entityId}`}
                            className="inline-flex items-center gap-1 rounded text-indigo-500 underline-offset-2 transition-colors hover:text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-indigo-300"
                          >
                            {shortId(log.entityId)}
                            <ExternalLink className="size-3" aria-hidden />
                          </Link>
                        ) : (
                          (log.entityId ?? '—')
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-[18rem] truncate font-mono text-[11px] text-muted-foreground lg:table-cell">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground xl:table-cell">
                        {log.ipAddress ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
                onPageChange={setPage}
                className="px-4"
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}
