import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatTime,
  fullName,
  GENDER_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
} from '@/lib/format';

describe('formatNumber', () => {
  it('formats with en-US grouping regardless of the runtime locale', () => {
    expect(formatNumber(12847)).toBe('12,847');
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(0)).toBe('0');
  });

  it('honours percentage options', () => {
    expect(formatNumber(0.37, { style: 'percent' })).toBe('37%');
  });
});

describe('formatDate', () => {
  it('formats an ISO date as a short human date', () => {
    expect(formatDate('2023-06-01T00:00:00Z')).toBe('Jun 1, 2023');
  });

  it('returns an em dash for null/undefined/invalid input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });
});

describe('formatTime / formatDateTime', () => {
  it('formats a time with a fixed locale', () => {
    // Local-time input so the assertion is timezone-independent.
    expect(formatTime(new Date(2026, 7, 8, 17, 32).toISOString())).toBe('5:32 PM');
  });

  it('formats date + time', () => {
    expect(formatDateTime('2026-08-08T17:32:00Z')).toContain('2026');
    expect(formatDateTime(null)).toBe('—');
  });
});

describe('formatRelative', () => {
  it('describes time deltas in words', () => {
    const now = Date.now();
    expect(formatRelative(new Date(now).toISOString())).toBe('just now');
    expect(formatRelative(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(formatRelative(new Date(now - 3 * 3_600_000).toISOString())).toBe('3h ago');
    expect(formatRelative(new Date(now - 2 * 86_400_000).toISOString())).toBe('2d ago');
  });

  it('falls back to a date for old timestamps', () => {
    expect(formatRelative('2020-01-01T00:00:00Z')).toBe('Jan 1, 2020');
  });

  it('returns an em dash for null', () => {
    expect(formatRelative(null)).toBe('—');
  });
});

describe('labels', () => {
  it('maps every status and gender to a human label', () => {
    expect(STATUS_LABELS.active).toBe('Active');
    expect(STATUS_LABELS.on_leave).toBe('On Leave');
    expect(GENDER_LABELS.prefer_not_to_say).toBe('Prefer not to say');
  });

  it('provides a badge variant for every status', () => {
    for (const status of Object.keys(STATUS_LABELS)) {
      expect(STATUS_VARIANTS[status as keyof typeof STATUS_LABELS]).toBeDefined();
    }
  });
});

describe('fullName', () => {
  it('joins first and last name', () => {
    expect(fullName('Alex', 'Morgan')).toBe('Alex Morgan');
  });
});
