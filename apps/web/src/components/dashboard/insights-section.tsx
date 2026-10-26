'use client';

import type { WorkforceInsight } from '@orgwise/types';
import { AlertTriangle, ArrowRight, Info, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SEVERITY_META = {
  positive: {
    label: 'Positive',
    variant: 'success' as const,
    icon: Sparkles,
    ring: 'border-emerald-500/20',
  },
  attention: {
    label: 'Attention',
    variant: 'warning' as const,
    icon: AlertTriangle,
    ring: 'border-amber-500/25',
  },
  neutral: {
    label: 'Observation',
    variant: 'secondary' as const,
    icon: Info,
    ring: 'border-border',
  },
};
// Workforce Insights — deterministic observations derived from the current dataset (patterns and correlations,…
// never predictions). Each card carries a drill-down that opens the employee explorer pre-filtered, connecting…
export function InsightsSection({ insights }: { insights: WorkforceInsight[] }) {
  if (insights.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card/60 p-4 text-center text-sm text-muted-foreground">
        Not enough data to generate insights for the current filters yet.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {insights.map((insight) => {
        const meta = SEVERITY_META[insight.severity];
        const Icon = meta.icon;
        const href = insight.drillDown
          ? `${insight.drillDown.path}?${new URLSearchParams(insight.drillDown.params)}`
          : null;
        return (
          <div
            key={insight.id}
            className={cn(
              'group relative flex flex-col gap-2.5 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md',
              meta.ring,
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg',
                  insight.severity === 'positive'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : insight.severity === 'attention'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <Badge variant={meta.variant}>{meta.label}</Badge>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-snug text-foreground">
                {insight.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
            </div>
            {href ? (
              <Link
                href={href}
                className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-500 transition-colors hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded dark:text-indigo-300"
              >
                Investigate{' '}
                <ArrowRight
                  className="size-3 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
