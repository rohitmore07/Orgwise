'use client';

import type { AnalyticsOverview } from '@orgwise/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent, formatRating } from '@/lib/format';
import { ClickableDonut, useExplorerNavigation } from './analytics-charts';

function EngagementDonut({
  title,
  data,
  average,
  buildParams,
}: {
  title: string;
  data: AnalyticsOverview['engagement']['jobSatisfaction'];
  average: number | null;
  buildParams: (level: number) => Record<string, string>;
}) {
  const navigate = useExplorerNavigation();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Avg {formatRating(average)} · click a level to explore
        </p>
      </CardHeader>
      <CardContent>
        <ClickableDonut
          data={data}
          title={title}
          onSelect={(name) => {
            const level = Number(name.replace('Level ', '').trim());
            if (Number.isInteger(level)) navigate(buildParams(level));
          }}
        />
      </CardContent>
    </Card>
  );
}
// Engagement & Culture — satisfaction dimensions measured on the 1–4 scale plus overtime prevalence. Charts…
// reflect the fields actually in the dataset; no survey metrics are invented.
export function EngagementSection({ overview }: { overview: AnalyticsOverview }) {
  const { engagement } = overview;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip
          label="Avg job satisfaction"
          value={formatRating(engagement.averageJobSatisfaction)}
        />
        <StatChip
          label="Avg work-life balance"
          value={formatRating(engagement.averageWorkLifeBalance)}
        />
        <StatChip label="Overtime rate" value={formatPercent(engagement.overtimeRate)} />
        <StatChip label="Scale" value="1 – 4" muted />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <EngagementDonut
          title="Job satisfaction"
          data={engagement.jobSatisfaction}
          average={engagement.averageJobSatisfaction}
          buildParams={(level) => ({ jobSatisfaction: String(level) })}
        />
        <EngagementDonut
          title="Environment satisfaction"
          data={engagement.environmentSatisfaction}
          average={null}
          buildParams={(level) => ({ environmentSatisfaction: String(level) })}
        />
        <EngagementDonut
          title="Relationship satisfaction"
          data={engagement.relationshipSatisfaction}
          average={null}
          buildParams={(level) => ({ relationshipSatisfaction: String(level) })}
        />
        <EngagementDonut
          title="Work-life balance"
          data={engagement.workLifeBalance}
          average={engagement.averageWorkLifeBalance}
          buildParams={(level) => ({ workLifeBalance: String(level) })}
        />
      </div>
    </div>
  );
}

function StatChip({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-display text-lg font-semibold ${muted ? 'text-muted-foreground' : 'text-foreground'}`}
      >
        {value}
      </p>
    </div>
  );
}
