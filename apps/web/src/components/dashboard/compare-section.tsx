'use client';

import type { DepartmentComparison } from '@orgwise/types';
import { Loader2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatIncome, formatPercent, formatRating, formatYears } from '@/lib/format';
import { AskAboutDataButton, ExportCsvButton } from './chart-actions';

interface CompareSectionProps {
  /** Scope-aware department options. */
  departments: Array<{ id: string; name: string }>;
  /** Currently selected department ids (ordered). */
  selection: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  data: DepartmentComparison[] | null;
  loading: boolean;
  /** Same-scope company averages (from the overview KPIs) for reference. */
  companyAverage?: CompanyAverage | null;
}

interface CompanyAverage {
  headcount: number;
  attritionRate: number | null;
  averageTenureYears: number | null;
  averageMonthlyIncome: number | null;
  overtimeRate: number | null;
  averageJobSatisfaction: number | null;
  averagePerformanceRating: number | null;
}

const MAX_COMPARE = 5;
// Department Comparison — select up to five departments and read headcount, attrition, tenure, income,…
// overtime, satisfaction and performance side-by-side. Best/worst values are highlighted so differences surface…
export function CompareSection({
  departments,
  selection,
  onToggle,
  onClear,
  data,
  loading,
  companyAverage,
}: CompareSectionProps) {
  const toggle = (id: string) => {
    if (selection.includes(id)) {
      onToggle(id);
      return;
    }
    if (selection.length >= MAX_COMPARE) return;
    onToggle(id);
  };
  // Best/worst per metric across the selected departments (higher-is-better
  // vs lower-is-better differ per metric).
  const extremes = (() => {
    if (!data || data.length < 2)
      return { best: {} as Record<string, string>, worst: {} as Record<string, string> };
    const best: Record<string, string> = {};
    const worst: Record<string, string> = {};
    const metric = <K extends keyof DepartmentComparison>(key: K, lowerBetter: boolean) => {
      const values = data
        .map((d) => ({ id: d.departmentId, value: d[key] as number | null }))
        .filter((v): v is { id: string; value: number } => typeof v.value === 'number');
      if (values.length < 2) return;
      const sorted = [...values].sort((a, b) =>
        lowerBetter ? a.value - b.value : b.value - a.value,
      );
      best[key as string] = sorted[0]!.id;
      worst[key as string] = sorted[sorted.length - 1]!.id;
    };
    metric('attritionRate', true);
    metric('overtimeRate', true);
    metric('averageTenureYears', false);
    metric('averageJobSatisfaction', false);
    metric('averagePerformanceRating', false);
    metric('averageMonthlyIncome', false);
    return { best, worst };
  })();

  const rows: Array<{
    label: string;
    key: keyof DepartmentComparison;
    format: (v: number | null) => string;
  }> = [
    { label: 'Headcount', key: 'headcount', format: (v) => String(v ?? 0) },
    { label: 'Attrition', key: 'attritionRate', format: (v) => formatPercent(v) },
    { label: 'Avg tenure', key: 'averageTenureYears', format: (v) => formatYears(v) },
    { label: 'Avg income', key: 'averageMonthlyIncome', format: (v) => formatIncome(v) },
    { label: 'Overtime', key: 'overtimeRate', format: (v) => formatPercent(v) },
    { label: 'Job satisfaction', key: 'averageJobSatisfaction', format: (v) => formatRating(v) },
    { label: 'Performance', key: 'averagePerformanceRating', format: (v) => formatRating(v) },
  ];

  return (
    <div className="space-y-4">
      {/* Selector chips */}
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Compare departments
          </span>
          {departments.map((dept) => {
            const selected = selection.includes(dept.id);
            const disabled = !selected && selection.length >= MAX_COMPARE;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => toggle(dept.id)}
                disabled={disabled}
                aria-pressed={selected}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                {selected ? (
                  <X className="size-3" aria-hidden />
                ) : (
                  <Plus className="size-3" aria-hidden />
                )}
                {dept.name}
              </button>
            );
          })}
          {selection.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Clear ({selection.length})
            </button>
          ) : null}
          {data && data.length >= 2 ? (
            <div className="flex w-full items-center gap-1 sm:w-auto">
              <ExportCsvButton
                filename="department-comparison.csv"
                rows={data.map((d) => ({
                  department: d.name,
                  headcount: d.headcount,
                  attritionRate: d.attritionRate,
                  averageTenureYears: d.averageTenureYears,
                  averageMonthlyIncome: d.averageMonthlyIncome,
                  overtimeRate: d.overtimeRate,
                  averageJobSatisfaction: d.averageJobSatisfaction,
                  averagePerformanceRating: d.averagePerformanceRating,
                }))}
              />
              <AskAboutDataButton question={`Compare ${data.map((d) => d.name).join(' and ')}`} />
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Select 2–{MAX_COMPARE} departments to compare. Best value per metric is highlighted green;
          worst is highlighted red.
        </p>
      </div>

      {/* Comparison table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Comparing…
        </div>
      ) : data && data.length >= 2 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="w-40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Metric
                </th>
                {data.map((d) => (
                  <th
                    key={d.departmentId}
                    className="px-4 py-3 text-left font-display font-semibold text-foreground"
                  >
                    {d.name}
                  </th>
                ))}
                {companyAverage ? (
                  <th className="border-l border-dashed border-border/60 px-4 py-3 text-left font-display font-semibold text-muted-foreground">
                    Company avg
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    {row.label}
                  </td>
                  {data.map((d) => {
                    const raw = d[row.key];
                    const isBest = extremes.best[row.key] === d.departmentId;
                    const isWorst = extremes.worst[row.key] === d.departmentId;
                    return (
                      <td
                        key={d.departmentId}
                        className={cn(
                          'px-4 py-2.5 font-medium',
                          isBest
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isWorst
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-foreground',
                        )}
                      >
                        {row.format(raw as number | null)}
                        {isBest ? (
                          <span className="ml-1.5 rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                            best
                          </span>
                        ) : null}
                        {isWorst ? (
                          <span className="ml-1.5 rounded bg-rose-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-rose-600 dark:text-rose-400">
                            worst
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  {companyAverage ? (
                    <td className="border-l border-dashed border-border/60 px-4 py-2.5 font-medium text-muted-foreground">
                      {row.format(
                        (companyAverage as unknown as Record<string, number | null>)[row.key] ??
                          null,
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data && data.length === 1 ? (
        <p className="rounded-xl border border-border bg-card/60 p-4 text-center text-sm text-muted-foreground">
          Select at least two departments to see a comparison.
        </p>
      ) : (
        <p className="rounded-xl border border-border bg-card/60 p-4 text-center text-sm text-muted-foreground">
          Select departments above to compare headcount, attrition, tenure, income and engagement.
        </p>
      )}
    </div>
  );
}
