import type { AgeGroup, EmployeeStatus, Gender, TenureGroup } from '@orgwise/types';
import type { BadgeProps } from '@/components/ui/badge';

/** Human-readable employment status labels. */
export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  probation: 'Probation',
  terminated: 'Terminated',
};

/** Badge tone per employment status. */
export const STATUS_VARIANTS: Record<EmployeeStatus, NonNullable<BadgeProps['variant']>> = {
  active: 'success',
  on_leave: 'warning',
  probation: 'info',
  terminated: 'danger',
};

/** Human-readable gender labels. */
export const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
};

/** Age buckets (order matters — used as the axis order). */
export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  '<25': 'Under 25',
  '25-34': '25–34',
  '35-44': '35–44',
  '45-54': '45–54',
  '55+': '55+',
};

/** Tenure buckets (order matters — used as the axis order). */
export const TENURE_GROUP_LABELS: Record<TenureGroup, string> = {
  '<1': '< 1 yr',
  '1-2': '1–2 yrs',
  '3-5': '3–5 yrs',
  '6-10': '6–10 yrs',
  '10+': '10+ yrs',
};

/** Satisfaction level labels (1–4). */
export const SATISFACTION_LABELS: Record<number, string> = {
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4',
};

/** Education level labels (1–5). */
export const EDUCATION_LABELS: Record<number, string> = {
  1: 'Below College',
  2: 'College',
  3: "Bachelor's",
  4: "Master's",
  5: 'Doctorate',
};

/** Performance rating labels (1–4). */
export const PERFORMANCE_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Below average',
  3: 'Good',
  4: 'Excellent',
};
// Formats a number with en-US grouping (e.g. 12,847). The single source of truth for number formatting —…
// components must never call `toLocaleString()` directly, because the runtime default locale makes output…
export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return value.toLocaleString('en-US', options);
}

/** Formats an ISO date as a short human date (e.g. Jun 1, 2023). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
// Formats a time of day with a fixed locale (e.g. "5:32 PM") — tooltips/labels.
export function formatTime(iso: string | Date | null | undefined): string {
  const date = toDate(iso);
  if (!date) return '—';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
// Formats a full date + time with a fixed locale (e.g. "Aug 8, 2026, 6:32 PM") — audit-style timestamps and…
// tooltips.
export function formatDateTime(iso: string | Date | null | undefined): string {
  const date = toDate(iso);
  if (!date) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats an ISO date relative to now (e.g. "3d ago"). */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** Formats a full name from first/last. */
export function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}
// Formats a 0–1 ratio as a percentage (e.g. `0.206` → `20.6%`). `null` renders as `—` so "not calculable" never…
// looks like zero.
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Formats a monthly income value (e.g. `9800` → `$9,800/mo`). */
export function formatIncome(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `$${formatNumber(value)}/mo`;
}

/** Formats fractional years (e.g. `6.56` → `6.6 yrs`). */
export function formatYears(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(digits)} yrs`;
}

/** Formats a 1–4 rating as `3.0 / 4`. */
export function formatRating(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(digits)} / 4`;
}

/** Formats a duration in milliseconds as `2.4s` or `1m 12s`. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}
