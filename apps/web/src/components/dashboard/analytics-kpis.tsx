'use client';

import type { AnalyticsKpis } from '@orgwise/types';
import {
  Activity,
  Banknote,
  Building2,
  CalendarRange,
  Clock3,
  ShieldCheck,
  Star,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { formatIncome, formatPercent, formatRating, formatYears } from '@/lib/format';

function KpiValueCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
  valueClassName,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  accent: string;
  valueClassName?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span
          className={`flex size-9 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white shadow-sm`}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p
        className={`mt-3 font-display text-3xl font-semibold tracking-tight text-foreground ${valueClassName ?? ''}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
// Workforce-overview KPI grid. Every value is computed server-side for the active filter state. Metrics that…
// cannot be derived from a current snapshot are clearly labelled as such instead of showing fabricated trends.
export function AnalyticsKpis({ kpis }: { kpis: AnalyticsKpis }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiValueCard
        label="Headcount"
        value={String(kpis.totalEmployees)}
        icon={Users}
        hint="Active workforce records"
        accent="from-indigo-500 to-indigo-400"
      />
      <KpiValueCard
        label="Active"
        value={String(kpis.activeEmployees)}
        icon={Activity}
        hint="Currently employed"
        accent="from-emerald-500 to-emerald-400"
      />
      <KpiValueCard
        label="Attrition rate"
        value={formatPercent(kpis.attritionRate)}
        icon={Clock3}
        hint="Observed · current snapshot"
        accent="from-rose-500 to-rose-400"
        valueClassName={
          kpis.attritionRate !== null && kpis.attritionRate >= 0.2 ? 'text-rose-500' : undefined
        }
      />
      <KpiValueCard
        label="Avg tenure"
        value={formatYears(kpis.averageTenureYears)}
        icon={Timer}
        hint="Years at company"
        accent="from-cyan-500 to-cyan-400"
      />
      <KpiValueCard
        label="Avg age"
        value={kpis.averageAge === null ? '—' : `${kpis.averageAge.toFixed(1)}`}
        icon={CalendarRange}
        hint="Years"
        accent="from-violet-500 to-violet-400"
      />
      <KpiValueCard
        label="Avg monthly income"
        value={formatIncome(kpis.averageMonthlyIncome)}
        icon={Banknote}
        hint={kpis.averageMonthlyIncome === null ? 'Not available for your role' : 'USD / month'}
        accent="from-amber-500 to-amber-400"
      />
      <KpiValueCard
        label="Overtime rate"
        value={formatPercent(kpis.overtimeRate)}
        icon={Star}
        hint="Share working overtime"
        accent="from-orange-500 to-orange-400"
      />
      <KpiValueCard
        label="Avg performance"
        value={formatRating(kpis.averagePerformanceRating)}
        icon={ShieldCheck}
        hint="1 – 4 rating scale"
        accent="from-indigo-500 to-indigo-400"
      />
      <div className="col-span-full flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground/80">
        <span className="flex items-center gap-1.5">
          <Building2 className="size-3.5" aria-hidden /> {kpis.totalDepartments} departments
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5" aria-hidden /> {kpis.totalManagers} managers
        </span>
        <span className="flex items-center gap-1.5">
          <Activity className="size-3.5" aria-hidden /> {kpis.totalTeams} teams
        </span>
        <span className="ml-auto text-muted-foreground/60">
          {kpis.snapshot ? 'Current snapshot — historical trends unavailable in this dataset' : ''}
        </span>
      </div>
    </div>
  );
}
