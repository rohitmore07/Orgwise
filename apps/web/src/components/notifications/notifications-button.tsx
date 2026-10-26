'use client';

import type { NotificationItem } from '@orgwise/types';
import {
  Bell,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const POLL_MS = 30_000;

const SEVERITY_STYLES = {
  info: 'text-sky-500 bg-sky-500/10',
  success: 'text-emerald-500 bg-emerald-500/10',
  warning: 'text-amber-500 bg-amber-500/10',
  danger: 'text-rose-500 bg-rose-500/10',
} as const;

function SeverityIcon({ item }: { item: NotificationItem }) {
  if (item.type === 'import') {
    return <FileSpreadsheet className="size-4" aria-hidden />;
  }
  switch (item.severity) {
    case 'danger':
      return <ShieldAlert className="size-4" aria-hidden />;
    case 'warning':
      return <TriangleAlert className="size-4" aria-hidden />;
    case 'success':
      return <CheckCircle2 className="size-4" aria-hidden />;
    default:
      return <Info className="size-4" aria-hidden />;
  }
}

/** Topbar bell — recent imports and the caller's own audit actions. */
export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await api.get<NotificationItem[]>('/notifications?limit=8');
        if (!cancelled) setItems(data);
      } catch {
        // Bell is non-critical — keep the last known feed on transient errors.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-4.5" aria-hidden />
        {items.length > 0 ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Activity</p>
            <span className="text-[11px] text-muted-foreground">
              {loading ? 'Refreshing…' : `${items.length} recent`}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="size-5" aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
                <p className="text-xs text-muted-foreground">
                  Imports and your recent actions will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {items.map((item) => {
                  const icon = (
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        SEVERITY_STYLES[item.severity ?? 'info'],
                      )}
                    >
                      <SeverityIcon item={item} />
                    </span>
                  );
                  const content = (
                    <span className="flex min-w-0 items-start gap-3 p-3">
                      {icon}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                          {formatRelative(item.createdAt)}
                        </span>
                      </span>
                    </span>
                  );
                  return (
                    <li key={item.id}>
                      {item.link ? (
                        <Link
                          href={item.link}
                          onClick={() => setOpen(false)}
                          className="block transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
