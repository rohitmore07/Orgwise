// Shared analytics calculations — the single source of truth for the groupings and filters used by BOTH the…
// analytics engine and the employee explorer, so a bucket shown in a chart filters the same records the…
import type { Prisma } from '@prisma/client';
import type { AgeGroup, DashboardFilters, TenureGroup } from '@orgwise/types';

/** Years in one millisecond (365.25-day year — matches payroll conventions). */
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/** Age of a person in years (fractional), null when unknown or in the future. */
export function ageYears(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const ms = Date.now() - dateOfBirth.getTime();
  return ms >= 0 ? ms / MS_PER_YEAR : null;
}

/** Age bucket, null when the birth date is unknown. */
export function ageGroupOf(dateOfBirth: Date | null | undefined): AgeGroup | null {
  const years = ageYears(dateOfBirth);
  if (years === null) return null;
  if (years < 25) return '<25';
  if (years < 35) return '25-34';
  if (years < 45) return '35-44';
  if (years < 55) return '45-54';
  return '55+';
}

/** Years of company tenure (fractional), null when unknown or in the future. */
export function tenureYears(hiredAt: Date | null | undefined): number | null {
  if (!hiredAt) return null;
  const ms = Date.now() - hiredAt.getTime();
  return ms >= 0 ? ms / MS_PER_YEAR : null;
}

/** Tenure bucket, null when the hire date is unknown. */
export function tenureGroupOf(hiredAt: Date | null | undefined): TenureGroup | null {
  const years = tenureYears(hiredAt);
  if (years === null) return null;
  if (years < 1) return '<1';
  if (years < 3) return '1-2';
  if (years < 6) return '3-5';
  if (years < 10) return '6-10';
  return '10+';
}

/** Prisma date-range filter for an age or tenure bucket. */
export function buildGroupFilter(
  kind: 'age' | 'tenure',
  group: AgeGroup | TenureGroup,
): Prisma.EmployeeWhereInput {
  const now = Date.now();
  const at = (n: number) => new Date(now - n * MS_PER_YEAR);
  const ranges: Record<string, Prisma.DateTimeFilter> = {
    '<25': { gt: at(25) },
    '25-34': { gt: at(34), lte: at(25) },
    '35-44': { gt: at(44), lte: at(34) },
    '45-54': { gt: at(54), lte: at(44) },
    '55+': { lte: at(54) },
    '<1': { gt: at(1) },
    '1-2': { gt: at(2), lte: at(1) },
    '3-5': { gt: at(5), lte: at(2) },
    '6-10': { gt: at(10), lte: at(5) },
    '10+': { lte: at(10) },
  };
  return { [kind === 'age' ? 'dateOfBirth' : 'hiredAt']: ranges[group] ?? { gt: at(200) } };
}
// Scope-aware `where` builder for employee analytics queries. The manager scope is AUTHORITATIVE — an explicit…
// `departmentId` filter can only narrow it, never widen it (the same intersect pattern used across the…
export function buildAnalyticsWhere(
  scope: string[] | null,
  filters: DashboardFilters,
): Prisma.EmployeeWhereInput {
  const departmentFilter: string | { in: string[] } | undefined = scope
    ? filters.departmentId
      ? scope.includes(filters.departmentId)
        ? filters.departmentId
        : { in: [] }
      : { in: scope }
    : filters.departmentId;

  return {
    deletedAt: null,
    ...(departmentFilter ? { departmentId: departmentFilter } : {}),
    ...(filters.teamId ? { teamId: filters.teamId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.gender ? { gender: filters.gender } : {}),
    ...(filters.jobTitle ? { jobTitle: { equals: filters.jobTitle, mode: 'insensitive' } } : {}),
    ...(filters.overTime !== undefined ? { overTime: filters.overTime } : {}),
    ...(filters.attrition !== undefined ? { attrition: filters.attrition } : {}),
    ...(filters.jobSatisfaction ? { jobSatisfaction: filters.jobSatisfaction } : {}),
    ...(filters.environmentSatisfaction
      ? { environmentSatisfaction: filters.environmentSatisfaction }
      : {}),
    ...(filters.relationshipSatisfaction
      ? { relationshipSatisfaction: filters.relationshipSatisfaction }
      : {}),
    ...(filters.workLifeBalance ? { workLifeBalance: filters.workLifeBalance } : {}),
    ...(filters.education ? { education: filters.education } : {}),
    ...(filters.ageGroup ? buildGroupFilter('age', filters.ageGroup) : {}),
    ...(filters.tenureGroup ? buildGroupFilter('tenure', filters.tenureGroup) : {}),
  };
}

/** Mean of the present values, or null when there are none. */
export function average(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

/** Ratio part/total clamped to [0, 1]; null when total is zero. */
export function rate(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.min(1, Math.max(0, part / total));
}

/** Formats a 0–1 ratio as a human percent for insight copy. */
export function formatRate(ratio: number | null, digits = 1): string {
  if (ratio === null) return 'n/a';
  return `${(ratio * 100).toFixed(digits)}%`;
}
