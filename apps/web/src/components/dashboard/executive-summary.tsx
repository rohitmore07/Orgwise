'use client';

import type { ExecutiveSummary } from '@orgwise/types';
import { Activity, AlertTriangle, HeartPulse, ListChecks, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/format';

const STATUS_META = {
  healthy: {
    label: 'Healthy',
    icon: HeartPulse,
    variant: 'success' as const,
    ring: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-cyan-500/10',
  },
  stable: {
    label: 'Stable',
    icon: Activity,
    variant: 'info' as const,
    ring: 'border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-card to-indigo-500/10',
  },
  attention: {
    label: 'Needs attention',
    icon: AlertTriangle,
    variant: 'warning' as const,
    ring: 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-rose-500/10',
  },
} as const;
// Executive summary — the first answer a dashboard should give: is the workforce healthy, what deserves…
// attention, and where to investigate next. Deterministic: derived from the observed KPIs for the current…
export function ExecutiveSummaryCard({ summary }: { summary: ExecutiveSummary }) {
  const meta = STATUS_META[summary.status];
  const Icon = meta.icon;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 ${meta.ring}`}
      role="status"
      aria-label={`Workforce health: ${meta.label}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20">
            <Icon className="size-5 text-indigo-500 dark:text-indigo-300" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                Workforce health
              </h2>
              <Badge variant={meta.variant}>{meta.label}</Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="no-print ml-auto h-7 gap-1.5 text-xs"
                onClick={() => window.print()}
              >
                <Printer className="size-3.5" aria-hidden />
                Print / Export PDF
              </Button>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {summary.headline}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              Based on the current dataset · updated {formatRelative(summary.updatedAt)}
            </p>
          </div>
        </div>

        {summary.keyAreas.length > 0 ? (
          <div className="w-full shrink-0 rounded-xl border border-border/60 bg-card/60 p-3.5 lg:max-w-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <ListChecks className="size-3.5" aria-hidden /> Key areas
            </p>
            <ol className="mt-2 space-y-1.5">
              {summary.keyAreas.map((area, index) => (
                <li key={area} className="flex items-start gap-2 text-xs text-foreground/90">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{area}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}
