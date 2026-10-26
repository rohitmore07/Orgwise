import type { AgeGroup, DashboardFilters, Gender, TenureGroup } from '@orgwise/types';
// Serialization helpers for the global analytics filter state. The SAME filter model drives the dashboard URL…
// (`/dashboard?department=…&gender=…`), the analytics API, and the employee explorer drill-down — one source of…

/** Valid status values (mirrors EmployeeStatus). */
const STATUSES = ['active', 'on_leave', 'probation', 'terminated'] as const;
const GENDERS: Gender[] = ['female', 'male', 'non_binary', 'prefer_not_to_say'];
const AGE_GROUPS: AgeGroup[] = ['<25', '25-34', '35-44', '45-54', '55+'];
const TENURE_GROUPS: TenureGroup[] = ['<1', '1-2', '3-5', '6-10', '10+'];

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Serializes the active filters into URL search parameters. */
export function filtersToQuery(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | boolean | undefined | null) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  };
  set('departmentId', filters.departmentId);
  set('teamId', filters.teamId);
  set('status', filters.status);
  set('gender', filters.gender);
  set('jobTitle', filters.jobTitle);
  set('overTime', filters.overTime);
  set('attrition', filters.attrition);
  set('jobSatisfaction', filters.jobSatisfaction);
  set('environmentSatisfaction', filters.environmentSatisfaction);
  set('relationshipSatisfaction', filters.relationshipSatisfaction);
  set('workLifeBalance', filters.workLifeBalance);
  set('ageGroup', filters.ageGroup);
  set('tenureGroup', filters.tenureGroup);
  set('education', filters.education);
  return params;
}

/** Parses URL search parameters into a validated filter object. */
export function queryToFilters(search: string | URLSearchParams | null): DashboardFilters {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search)
      : search instanceof URLSearchParams
        ? search
        : new URLSearchParams();
  const filters: DashboardFilters = {};
  const string = (key: string): string | undefined => params.get(key) ?? undefined;

  const departmentId = string('departmentId');
  const teamId = string('teamId');
  const status = oneOf(params.get('status'), STATUSES);
  const gender = oneOf(params.get('gender'), GENDERS);
  const jobTitle = string('jobTitle');
  const ageGroup = oneOf(params.get('ageGroup'), AGE_GROUPS);
  const tenureGroup = oneOf(params.get('tenureGroup'), TENURE_GROUPS);

  if (departmentId) filters.departmentId = departmentId;
  if (teamId) filters.teamId = teamId;
  if (status) filters.status = status;
  if (gender) filters.gender = gender;
  if (jobTitle) filters.jobTitle = jobTitle;
  if (ageGroup) filters.ageGroup = ageGroup;
  if (tenureGroup) filters.tenureGroup = tenureGroup;

  const bool = (key: string): boolean | undefined => {
    const raw = params.get(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
  };
  const overTime = bool('overTime');
  const attrition = bool('attrition');
  if (overTime !== undefined) filters.overTime = overTime;
  if (attrition !== undefined) filters.attrition = attrition;

  const int = (key: string, min: number, max: number): number | undefined => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
  };
  const jobSatisfaction = int('jobSatisfaction', 1, 4);
  const environmentSatisfaction = int('environmentSatisfaction', 1, 4);
  const relationshipSatisfaction = int('relationshipSatisfaction', 1, 4);
  const workLifeBalance = int('workLifeBalance', 1, 4);
  const education = int('education', 1, 5);
  if (jobSatisfaction !== undefined) filters.jobSatisfaction = jobSatisfaction;
  if (environmentSatisfaction !== undefined)
    filters.environmentSatisfaction = environmentSatisfaction;
  if (relationshipSatisfaction !== undefined)
    filters.relationshipSatisfaction = relationshipSatisfaction;
  if (workLifeBalance !== undefined) filters.workLifeBalance = workLifeBalance;
  if (education !== undefined) filters.education = education;

  return filters;
}

/** Builds a stable dependency key for the current filter state. */
export function filtersKey(filters: DashboardFilters): string {
  return filtersToQuery(filters).toString();
}

/** Number of active (non-empty) filters. */
export function activeFilterCount(filters: DashboardFilters): number {
  return Object.values(filters).filter((v) => v !== undefined && v !== null && v !== '').length;
}
