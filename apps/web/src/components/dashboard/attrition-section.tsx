'use client';

import type { AnalyticsOverview } from '@orgwise/types';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AskAboutDataButton, ExportCsvButton } from './chart-actions';
import { AttritionRateChart, useExplorerNavigation, type SliceParams } from './analytics-charts';

function deptParams(deptIdByName: Map<string, string>): SliceParams {
  return (name) => ({
    departmentId: deptIdByName.get(name) ?? '',
    attrition: 'true',
  });
}

const ROLE_PARAMS: SliceParams = (name) => ({ jobTitle: name, attrition: 'true' });
const AGE_PARAMS: SliceParams = (name) => ({ ageGroup: name, attrition: 'true' });
const TENURE_PARAMS: SliceParams = (name) => ({ tenureGroup: name, attrition: 'true' });
const OVERTIME_PARAMS: SliceParams = (name) =>
  name === 'Overtime'
    ? { overTime: 'true', attrition: 'true' }
    : { overTime: 'false', attrition: 'true' };
const SATISFACTION_PARAMS: SliceParams = (name) => {
  const level = name.replace('Level ', '').trim();
  return { jobSatisfaction: level, attrition: 'true' };
};

function AttritionCard({
  title,
  question,
  slices,
  buildParams,
  layout,
  className,
}: {
  title: string;
  question: string;
  slices: AnalyticsOverview['attrition']['byDepartment'];
  buildParams: SliceParams;
  layout?: 'horizontal' | 'vertical';
  className?: string;
}) {
  const navigate = useExplorerNavigation();
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{question}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <ExportCsvButton
              filename={`attrition-${title.replace(/\s+/g, '-').toLowerCase()}.csv`}
              rows={slices.map((slice) => ({
                segment: slice.name,
                headcount: slice.headcount,
                attritionCount: slice.attritionCount,
                attritionRate: slice.attritionRate,
              }))}
            />
            <AskAboutDataButton question={`What patterns are behind "${title.toLowerCase()}"?`} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AttritionRateChart
          slices={slices}
          layout={layout}
          height={layout === 'horizontal' ? Math.max(140, slices.length * 26) : 170}
          onSelect={(name) => navigate(buildParams(name))}
        />
      </CardContent>
    </Card>
  );
}
// Retention & Attrition — answers "where is retention risk concentrated?" Every chart drills down: clicking a…
// slice opens the employee explorer pre-filtered to that population.
export function AttritionSection({ overview }: { overview: AnalyticsOverview }) {
  const deptIdByName = useMemo(
    () => new Map(overview.departments.map((d) => [d.name, d.id])),
    [overview.departments],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      <AttritionCard
        title="Attrition by department"
        question="Where is retention risk highest?"
        slices={overview.attrition.byDepartment}
        buildParams={deptParams(deptIdByName)}
        layout="horizontal"
        className="lg:col-span-2 xl:col-span-1"
      />
      <AttritionCard
        title="Attrition by job role"
        question="Which roles lose people fastest?"
        slices={overview.attrition.byJobRole.slice(0, 8)}
        buildParams={ROLE_PARAMS}
        layout="horizontal"
        className="lg:col-span-2 xl:col-span-1"
      />
      <AttritionCard
        title="Attrition by overtime"
        question="Is overtime a risk signal?"
        slices={overview.attrition.byOverTime}
        buildParams={OVERTIME_PARAMS}
        layout="horizontal"
        className="xl:col-span-1"
      />
      <AttritionCard
        title="Attrition by age group"
        question="Which age bands are most affected?"
        slices={overview.attrition.byAgeGroup}
        buildParams={AGE_PARAMS}
        className="xl:col-span-1"
      />
      <AttritionCard
        title="Attrition by tenure"
        question="Do newer or longer-tenured people leave more?"
        slices={overview.attrition.byTenure}
        buildParams={TENURE_PARAMS}
        className="xl:col-span-1"
      />
      <AttritionCard
        title="Attrition by job satisfaction"
        question="How strongly does satisfaction track attrition?"
        slices={overview.attrition.byJobSatisfaction}
        buildParams={SATISFACTION_PARAMS}
        className="xl:col-span-1"
      />
    </div>
  );
}
