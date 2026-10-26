'use client';

import type { AnalyticsOverview, HiringPipelineData } from '@orgwise/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatPercent, formatRating } from '@/lib/format';
import { ClickableBarChart, ClickableDonut, useExplorerNavigation } from './analytics-charts';

// Talent / Hiring — quality-of-hire proxies computed from the dataset (hiring
// velocity, recent-hire performance, early attrition) plus real pipeline
// metrics (time-to-hire, cost-per-hire, offer acceptance) from HiringRecord
// rows. Only genuinely unsupported metrics are listed as unavailable.
export function TalentSection({ overview }: { overview?: AnalyticsOverview | null }) {
  const navigate = useExplorerNavigation();

  if (!overview || !overview.talent) {
    return null;
  }

  const { talent } = overview;
  const hiresByDept = talent.hiresByDepartment ?? [];
  const recentPerf = talent.recentHirePerformance ?? [];
  const unavailableList = talent.unavailable ?? [];
  // Older API builds omit `pipeline` entirely — fall back so the section
  // renders with em-dashes instead of crashing on missing fields.
  const pipeline: Partial<HiringPipelineData> = talent.pipeline ?? {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip label="Hires · last 12 mo" value={formatNumber(talent.recentHires ?? 0)} />
        <StatChip
          label="Avg quality of hire"
          value={formatRating(talent.averageRecentHireRating ?? null)}
          hint="perf. rating, recent hires"
        />
        <StatChip
          label="Early attrition"
          value={formatPercent(talent.earlyAttrition?.attritionRate ?? null)}
          hint="<1 yr tenure"
        />
        <StatChip
          label="Time-to-hire"
          value={
            pipeline.averageTimeToHireDays !== null && pipeline.averageTimeToHireDays !== undefined
              ? `${Math.round(pipeline.averageTimeToHireDays)} days`
              : '—'
          }
          hint="req. opened → offer accepted"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip
          label="Cost-per-hire"
          value={
            pipeline.averageCostPerHire !== null && pipeline.averageCostPerHire !== undefined
              ? `$${Math.round(pipeline.averageCostPerHire).toLocaleString()}`
              : '—'
          }
          hint="sourcing + recruiting, avg"
        />
        <StatChip
          label="Offer acceptance"
          value={formatPercent(pipeline.offerAcceptanceRate ?? null)}
          hint={`${pipeline.offersSent ?? 0} offers decided`}
        />
        <StatChip label="Open requisitions" value={formatNumber(pipeline.openRequisitions ?? 0)} />
        <StatChip
          label="Filled · pipeline"
          value={formatNumber(pipeline.filledRequisitions ?? 0)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hiring velocity by department</CardTitle>
            <p className="text-xs text-muted-foreground">
              Hires in the last 12 months · click a bar to explore
            </p>
          </CardHeader>
          <CardContent>
            <ClickableBarChart
              data={hiresByDept}
              valueName="hires"
              layout="horizontal"
              height={Math.max(160, hiresByDept.length * 36)}
              onSelect={(name) => {
                const match = overview.departments?.find((d) => d.name === name);
                navigate(match ? { departmentId: match.id } : {});
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quality of hire</CardTitle>
            <p className="text-xs text-muted-foreground">
              Performance rating of hires in the last 24 months · click a level to explore
            </p>
          </CardHeader>
          <CardContent>
            <ClickableDonut
              data={recentPerf}
              title="Recent-hire performance"
              onSelect={(name) => {
                const level = Number(name.replace('Level ', '').trim());
                if (Number.isInteger(level)) navigate({ performanceRating: String(level) });
              }}
            />
          </CardContent>
        </Card>
      </div>

      {unavailableList.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Not available in current dataset
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            These metrics need data the current import does not contain:{' '}
            <span className="font-medium text-foreground">{unavailableList.join(', ')}</span>.
            Upload a hiring-pipeline CSV (or connect an ATS) to unlock them.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StatChip({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}
