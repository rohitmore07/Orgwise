import {
  ageGroupOf,
  ageYears,
  average,
  buildAnalyticsWhere,
  buildGroupFilter,
  formatRate,
  rate,
  tenureGroupOf,
  tenureYears,
} from './analytics.util';

describe('analytics.util', () => {
  describe('age buckets', () => {
    it('buckets ages correctly', () => {
      const at = (age: number) => new Date(Date.now() - age * 365.25 * 24 * 3600 * 1000);
      expect(ageGroupOf(at(24))).toBe('<25');
      expect(ageGroupOf(at(30))).toBe('25-34');
      expect(ageGroupOf(at(40))).toBe('35-44');
      expect(ageGroupOf(at(50))).toBe('45-54');
      expect(ageGroupOf(at(60))).toBe('55+');
      expect(ageGroupOf(null)).toBeNull();
    });

    it('returns fractional age in years', () => {
      const years = ageYears(new Date(Date.now() - 2 * 365.25 * 24 * 3600 * 1000));
      expect(years).toBeCloseTo(2, 5);
    });
  });

  describe('tenure buckets', () => {
    it('buckets tenure correctly', () => {
      const at = (years: number) => new Date(Date.now() - years * 365.25 * 24 * 3600 * 1000);
      expect(tenureGroupOf(at(0.5))).toBe('<1');
      expect(tenureGroupOf(at(1.5))).toBe('1-2');
      expect(tenureGroupOf(at(4))).toBe('3-5');
      expect(tenureGroupOf(at(8))).toBe('6-10');
      expect(tenureGroupOf(at(12))).toBe('10+');
      expect(tenureGroupOf(at(0))).toBe('<1');
    });

    it('rejects null hire dates', () => {
      expect(tenureYears(null)).toBeNull();
    });
  });

  describe('group filters', () => {
    it('builds an age-range filter for the <25 bucket', () => {
      const filter = buildGroupFilter('age', '<25') as { dateOfBirth: { gt: Date } };
      expect(filter.dateOfBirth.gt).toBeInstanceOf(Date);
      // The threshold should be ~25 years ago.
      const expected = Date.now() - 25 * 365.25 * 24 * 3600 * 1000;
      expect(Math.abs(filter.dateOfBirth.gt.getTime() - expected)).toBeLessThan(1000);
    });

    it('builds a tenure-range filter for the 6-10 bucket', () => {
      const filter = buildGroupFilter('tenure', '6-10') as {
        hiredAt: { gt: Date; lte: Date };
      };
      expect(filter.hiredAt.gt).toBeInstanceOf(Date);
      expect(filter.hiredAt.lte).toBeInstanceOf(Date);
    });
  });

  describe('scope-aware where builder', () => {
    it('intersects an out-of-scope department filter to an empty match', () => {
      const where = buildAnalyticsWhere(['d1'], { departmentId: 'd9' }) as {
        departmentId: { in: string[] };
      };
      expect(where.departmentId).toEqual({ in: [] });
    });

    it('narrows to an in-scope department filter', () => {
      const where = buildAnalyticsWhere(['d1', 'd2'], { departmentId: 'd2' }) as {
        departmentId: string;
      };
      expect(where.departmentId).toBe('d2');
    });

    it('constrains managers to their scope when no filter is given', () => {
      const where = buildAnalyticsWhere(['d1'], {}) as { departmentId: { in: string[] } };
      expect(where.departmentId).toEqual({ in: ['d1'] });
    });

    it('passes filters through for scope-less actors (admins/viewers)', () => {
      const where = buildAnalyticsWhere(null, { departmentId: 'd2', status: 'active' }) as {
        departmentId: string;
        status: string;
        deletedAt: null;
      };
      expect(where.departmentId).toBe('d2');
      expect(where.status).toBe('active');
      expect(where.deletedAt).toBeNull();
    });

    it('applies analytics filters (overtime, attrition, satisfaction, buckets)', () => {
      const where = buildAnalyticsWhere(null, {
        overTime: true,
        attrition: true,
        jobSatisfaction: 2,
        ageGroup: '35-44',
      }) as Record<string, unknown>;
      expect(where.overTime).toBe(true);
      expect(where.attrition).toBe(true);
      expect(where.jobSatisfaction).toBe(2);
      expect(where.dateOfBirth).toBeDefined();
    });
  });

  describe('helpers', () => {
    it('averages only present values', () => {
      expect(average([1, 2, 3])).toBe(2);
      expect(average([1, null, undefined])).toBe(1);
      expect(average([null, undefined])).toBeNull();
      expect(average([])).toBeNull();
    });

    it('computes a clamped ratio and null for empty totals', () => {
      expect(rate(1, 2)).toBe(0.5);
      expect(rate(2, 1)).toBe(1); // clamped
      expect(rate(1, 0)).toBeNull();
    });

    it('formats ratios as percentages', () => {
      expect(formatRate(0.206)).toBe('20.6%');
      expect(formatRate(0.5, 0)).toBe('50%');
      expect(formatRate(null)).toBe('n/a');
    });
  });
});
