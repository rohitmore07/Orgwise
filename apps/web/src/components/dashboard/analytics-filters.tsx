'use client';

import type {
  AgeGroup,
  DashboardFilters,
  EmployeeStatus,
  FilterOptions,
  Gender,
  TenureGroup,
} from '@orgwise/types';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  AGE_GROUP_LABELS,
  EDUCATION_LABELS,
  GENDER_LABELS,
  SATISFACTION_LABELS,
  STATUS_LABELS,
  TENURE_GROUP_LABELS,
} from '@/lib/format';

interface AnalyticsFiltersProps {
  filters: DashboardFilters;
  setFilter: <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K] | undefined,
  ) => void;
  resetFilters: () => void;
  activeCount: number;
  options: FilterOptions | null;
}

const YES_NO = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];
// The single global filter bar for the analytics dashboard. One coherent filter state feeds every section —…
// charts never build their own disconnected filters. State is URL-synced by the parent, so filtered views are…
export function AnalyticsFilters({
  filters,
  setFilter,
  resetFilters,
  activeCount,
  options,
}: AnalyticsFiltersProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Global filters
        </p>
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <Badge variant="secondary" className="h-5">
              {activeCount} active
            </Badge>
          ) : null}
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetFilters}>
              <RotateCcw className="size-3" aria-hidden /> Reset
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Select
          aria-label="Filter by department"
          placeholder="All departments"
          value={filters.departmentId ?? ''}
          onChange={(e) => setFilter('departmentId', e.target.value || undefined)}
          options={options?.departments.map((d) => ({ value: d.id, label: d.name })) ?? []}
        />
        <Select
          aria-label="Filter by job title"
          placeholder="All job titles"
          value={filters.jobTitle ?? ''}
          onChange={(e) => setFilter('jobTitle', e.target.value || undefined)}
          options={options?.jobTitles.map((t) => ({ value: t, label: t })) ?? []}
        />
        <Select
          aria-label="Filter by employment status"
          placeholder="All statuses"
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilter('status', (e.target.value || undefined) as EmployeeStatus | undefined)
          }
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          aria-label="Filter by gender"
          placeholder="All genders"
          value={filters.gender ?? ''}
          onChange={(e) => setFilter('gender', (e.target.value || undefined) as Gender | undefined)}
          options={Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          aria-label="Filter by age group"
          placeholder="All age groups"
          value={filters.ageGroup ?? ''}
          onChange={(e) =>
            setFilter('ageGroup', (e.target.value || undefined) as AgeGroup | undefined)
          }
          options={Object.entries(AGE_GROUP_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          aria-label="Filter by tenure"
          placeholder="All tenure"
          value={filters.tenureGroup ?? ''}
          onChange={(e) =>
            setFilter('tenureGroup', (e.target.value || undefined) as TenureGroup | undefined)
          }
          options={Object.entries(TENURE_GROUP_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          aria-label="Filter by overtime"
          placeholder="All overtime"
          value={filters.overTime === undefined ? '' : String(filters.overTime)}
          onChange={(e) =>
            setFilter('overTime', e.target.value === '' ? undefined : e.target.value === 'true')
          }
          options={YES_NO}
        />
        <Select
          aria-label="Filter by attrition"
          placeholder="All attrition"
          value={filters.attrition === undefined ? '' : String(filters.attrition)}
          onChange={(e) =>
            setFilter('attrition', e.target.value === '' ? undefined : e.target.value === 'true')
          }
          options={YES_NO}
        />
        <Select
          aria-label="Filter by job satisfaction"
          placeholder="All satisfaction"
          value={filters.jobSatisfaction === undefined ? '' : String(filters.jobSatisfaction)}
          onChange={(e) =>
            setFilter('jobSatisfaction', e.target.value === '' ? undefined : Number(e.target.value))
          }
          options={Object.entries(SATISFACTION_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <Select
          aria-label="Filter by education"
          placeholder="All education"
          value={filters.education === undefined ? '' : String(filters.education)}
          onChange={(e) =>
            setFilter('education', e.target.value === '' ? undefined : Number(e.target.value))
          }
          options={Object.entries(EDUCATION_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>
      {activeCount > 0 ? (
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          Every section below reflects the active filters. Click any chart slice to open that
          population in the employee explorer.
        </p>
      ) : null}
    </div>
  );
}
