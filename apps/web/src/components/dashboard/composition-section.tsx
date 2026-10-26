'use client';

import type { AnalyticsOverview } from '@orgwise/types';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EDUCATION_LABELS, GENDER_LABELS } from '@/lib/format';
import {
  ClickableBarChart,
  ClickableDonut,
  useExplorerNavigation,
  type SliceParams,
} from './analytics-charts';

function deptParams(deptIdByName: Map<string, string>): SliceParams {
  return (name) => ({ departmentId: deptIdByName.get(name) ?? '' });
}

const ROLE_PARAMS: SliceParams = (name) => ({ jobTitle: name });
const AGE_PARAMS: SliceParams = (name) => ({ ageGroup: name });
const TENURE_PARAMS: SliceParams = (name) => ({ tenureGroup: name });

/** Reverse gender lookup: label → enum value. */
const GENDER_BY_LABEL = new Map(
  Object.entries(GENDER_LABELS).map(([value, label]) => [label, value]),
);
const GENDER_PARAMS: SliceParams = (name) => ({ gender: GENDER_BY_LABEL.get(name) ?? '' });

/** Reverse education lookup: label → level. */
const EDUCATION_BY_LABEL = new Map(
  Object.entries(EDUCATION_LABELS).map(([value, label]) => [label, value]),
);
const EDUCATION_PARAMS: SliceParams = (name) => ({
  education: EDUCATION_BY_LABEL.get(name) ?? '',
});

function CompositionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
// Workforce Composition — where people sit, in what roles, and how the workforce is distributed by gender, age,…
// education and tenure. Clicking any slice filters the employee explorer to that population.
export function CompositionSection({ overview }: { overview: AnalyticsOverview }) {
  const navigate = useExplorerNavigation();
  const deptIdByName = useMemo(
    () => new Map(overview.departments.map((d) => [d.name, d.id])),
    [overview.departments],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      <CompositionCard title="Department distribution">
        <ClickableBarChart
          data={overview.composition.department}
          layout="horizontal"
          height={Math.max(140, overview.composition.department.length * 26)}
          onSelect={(name) => navigate(deptParams(deptIdByName)(name))}
        />
      </CompositionCard>
      <CompositionCard title="Job roles">
        <ClickableBarChart
          data={overview.composition.jobRole.slice(0, 10)}
          layout="vertical"
          height={210}
          onSelect={(name) => navigate(ROLE_PARAMS(name))}
        />
      </CompositionCard>
      <CompositionCard title="Gender">
        <ClickableDonut
          data={overview.composition.gender}
          title="Gender"
          onSelect={(name) => navigate(GENDER_PARAMS(name))}
        />
      </CompositionCard>
      <CompositionCard title="Age groups">
        <ClickableBarChart
          data={overview.composition.age}
          layout="vertical"
          height={180}
          onSelect={(name) => navigate(AGE_PARAMS(name))}
        />
      </CompositionCard>
      <CompositionCard title="Education">
        <ClickableBarChart
          data={overview.composition.education}
          layout="horizontal"
          height={170}
          onSelect={(name) => navigate(EDUCATION_PARAMS(name))}
        />
      </CompositionCard>
      <CompositionCard title="Tenure">
        <ClickableBarChart
          data={overview.composition.tenure}
          layout="horizontal"
          height={170}
          onSelect={(name) => navigate(TENURE_PARAMS(name))}
        />
      </CompositionCard>
    </div>
  );
}
