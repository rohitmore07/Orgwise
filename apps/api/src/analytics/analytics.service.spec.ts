import type { RbacService } from '@app/common/services/rbac.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { Role } from '@app/common/enums/role.enum';
import { AnalyticsService } from './analytics.service';
import {
  type AnalyticsRepository,
  type AnalyticsEmployeeRow,
  type HiringRecordRow,
} from './analytics.repository';

const actor = (role: Role = Role.ADMIN): RequestUser => ({
  sub: 'user-1',
  email: 'a@orgwise.com',
  roles: [role],
});

function row(overrides: Partial<AnalyticsEmployeeRow> = {}): AnalyticsEmployeeRow {
  return {
    id: 'e1',
    firstName: 'Alex',
    lastName: 'Morgan',
    jobTitle: 'Engineer',
    gender: 'female',
    status: 'active',
    departmentId: 'd1',
    hiredAt: new Date('2020-01-01'),
    dateOfBirth: new Date('1990-01-01'),
    attrition: false,
    monthlyIncome: 8000,
    jobSatisfaction: 3,
    environmentSatisfaction: 3,
    relationshipSatisfaction: 3,
    workLifeBalance: 3,
    overTime: false,
    performanceRating: 3,
    education: 3,
    educationField: 'Technical Degree',
    totalWorkingYears: 8,
    yearsAtCompany: 5,
    ...overrides,
  };
}

function createMocks(rows: AnalyticsEmployeeRow[]) {
  const repo = {
    getEmployeeRows: jest.fn().mockResolvedValue(rows),
    getDepartmentNames: jest.fn().mockResolvedValue([
      { id: 'd1', name: 'Engineering' },
      { id: 'd2', name: 'Sales' },
    ]),
    getOrgCounts: jest.fn().mockResolvedValue({ departments: 2, managers: 1, teams: 3 }),
    countDeleted: jest.fn().mockResolvedValue(0),
    getLastImport: jest.fn().mockResolvedValue(null),
    getHiringRecords: jest.fn().mockResolvedValue([]),
    getHierarchy: jest.fn().mockResolvedValue({ nodes: [], totalEmployees: 0 }),
    getJobTitles: jest.fn().mockResolvedValue([]),
  };
  const rbac = {
    departmentScope: jest.fn().mockResolvedValue(null),
    canWrite: jest.fn().mockReturnValue(true),
    isAdmin: jest.fn().mockReturnValue(true),
  };
  return { repo, rbac };
}

describe('AnalyticsService', () => {
  let mocks: ReturnType<typeof createMocks>;
  let service: AnalyticsService;

  beforeEach(() => {
    mocks = createMocks([]);
    service = new AnalyticsService(
      mocks.repo as unknown as AnalyticsRepository,
      mocks.rbac as unknown as RbacService,
    );
  });

  describe('overview KPIs', () => {
    it('computes attrition rate, averages and overtime rate from the projection', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([
        row({ id: 'a', attrition: false, monthlyIncome: 10000, overTime: true }),
        row({
          id: 'b',
          attrition: true,
          status: 'terminated',
          monthlyIncome: 6000,
          overTime: false,
        }),
        row({ id: 'c', attrition: false, monthlyIncome: 8000, overTime: false }),
      ]);

      const overview = await service.getOverview(actor());

      expect(overview.kpis.totalEmployees).toBe(3);
      expect(overview.kpis.activeEmployees).toBe(2);
      expect(overview.kpis.attritionRate).toBeCloseTo(1 / 3, 5);
      expect(overview.kpis.averageMonthlyIncome).toBeCloseTo(8000, 5);
      expect(overview.kpis.overtimeRate).toBeCloseTo(1 / 3, 5);
      expect(overview.kpis.snapshot).toBe(true);
    });

    it('gates averageMonthlyIncome to null for viewers', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([row()]);
      mocks.rbac.canWrite.mockReturnValue(false);

      const overview = await service.getOverview(actor(Role.VIEWER));

      expect(overview.kpis.averageMonthlyIncome).toBeNull();
      // Other (non-salary) metrics remain visible to viewers.
      expect(overview.kpis.totalEmployees).toBe(1);
    });
  });

  describe('attrition breakdown', () => {
    it('groups attrition by overtime and department', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([
        row({ id: 'a', departmentId: 'd1', overTime: true, attrition: true }),
        row({ id: 'b', departmentId: 'd1', overTime: true, attrition: false }),
        row({ id: 'c', departmentId: 'd2', overTime: false, attrition: false }),
      ]);

      const overview = await service.getOverview(actor());

      const overtimeSlice = overview.attrition.byOverTime.find((s) => s.name === 'Overtime')!;
      expect(overtimeSlice).toMatchObject({ headcount: 2, attritionCount: 1 });
      expect(overtimeSlice.attritionRate).toBeCloseTo(0.5, 5);

      const engineering = overview.attrition.byDepartment.find((s) => s.name === 'Engineering')!;
      expect(engineering.headcount).toBe(2);
    });
  });

  describe('insights', () => {
    it('flags the overtime correlation when overtime attrition is materially higher', async () => {
      const rows: AnalyticsEmployeeRow[] = [
        // Overtime group: 2/5 attrition (40%).
        ...[1, 2, 3, 4, 5].map((i) =>
          row({ id: `ot${i}`, overTime: true, attrition: i <= 2, jobSatisfaction: 2 }),
        ),
        // Non-overtime group: 0/5 attrition.
        ...[6, 7, 8, 9, 10].map((i) =>
          row({ id: `no${i}`, overTime: false, attrition: false, jobSatisfaction: 4 }),
        ),
      ];
      mocks.repo.getEmployeeRows.mockResolvedValue(rows);

      const overview = await service.getOverview(actor());
      const insight = overview.insights.find((i) => i.id === 'overtime-correlation');

      expect(insight).toBeDefined();
      expect(insight!.severity).toBe('attention');
      expect(insight!.drillDown?.params).toMatchObject({ overTime: 'true', attrition: 'true' });
    });

    it('labels the largest department by headcount, independent of the attrition ranking', async () => {
      // Sales is small but has 100% attrition; Engineering is large with none.
      const rows: AnalyticsEmployeeRow[] = [
        row({ id: 's1', departmentId: 'd2', attrition: true, status: 'terminated' }),
        row({ id: 's2', departmentId: 'd2', attrition: true, status: 'terminated' }),
        ...[1, 2, 3, 4, 5, 6].map((i) =>
          row({ id: `e${i}`, departmentId: 'd1', attrition: false }),
        ),
      ];
      mocks.repo.getEmployeeRows.mockResolvedValue(rows);

      const overview = await service.getOverview(actor());
      const insight = overview.insights.find((i) => i.id === 'largest-department');

      expect(insight).toBeDefined();
      expect(insight!.title).toBe('Engineering is the largest department');
      expect(insight!.body).toContain('6 employees');
      expect(insight!.drillDown?.params).toMatchObject({ departmentId: 'd1' });
    });

    it('does not claim an overtime correlation when rates are similar', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([
        row({ id: 'a', overTime: true, attrition: false }),
        row({ id: 'b', overTime: true, attrition: false }),
        row({ id: 'c', overTime: false, attrition: false }),
        row({ id: 'd', overTime: false, attrition: false }),
        row({ id: 'e', overTime: false, attrition: false }),
      ]);

      const overview = await service.getOverview(actor());
      expect(overview.insights.find((i) => i.id === 'overtime-correlation')).toBeUndefined();
    });
  });

  describe('executive summary', () => {
    it('reports attention when observed attrition is high', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([
        row({ id: 'a', attrition: true, status: 'terminated' }),
        row({ id: 'b', attrition: true, status: 'terminated' }),
        row({ id: 'c', attrition: false }),
        row({ id: 'd', attrition: false }),
      ]);

      const overview = await service.getOverview(actor());
      expect(overview.executiveSummary.status).toBe('attention');
    });

    it('reports healthy when attrition is low and overtime is contained', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([
        row({ id: 'a', attrition: false }),
        row({ id: 'b', attrition: false }),
        row({ id: 'c', attrition: false }),
        row({ id: 'd', attrition: false }),
        row({ id: 'e', attrition: false }),
        row({ id: 'f', attrition: false }),
        row({ id: 'g', attrition: false }),
        row({ id: 'h', attrition: false }),
        row({ id: 'i', attrition: true, status: 'terminated' }),
      ]);

      const overview = await service.getOverview(actor());
      expect(overview.executiveSummary.status).toBe('healthy');
    });
  });

  function hiringRow(overrides: Partial<HiringRecordRow> = {}): HiringRecordRow {
    return {
      id: 'h1',
      requisitionId: 'REQ-1',
      jobTitle: 'Engineer',
      departmentId: 'd1',
      openedAt: new Date('2026-01-01'),
      offerSentAt: new Date('2026-02-01'),
      acceptedAt: new Date('2026-02-10'),
      sourcingCost: 1000,
      recruitingCost: 2000,
      offerStatus: 'accepted',
      status: 'hired',
      ...overrides,
    };
  }

  describe('talent / hiring pipeline', () => {
    it('computes time-to-hire, cost-per-hire and offer acceptance from HiringRecord rows', async () => {
      const { repo, rbac } = createMocks([row()]);
      repo.getHiringRecords.mockResolvedValue([
        hiringRow({
          id: 'h1',
          openedAt: new Date('2026-01-01'),
          acceptedAt: new Date('2026-01-31'),
          sourcingCost: 1000,
          recruitingCost: 2000,
        }),
        hiringRow({
          id: 'h2',
          openedAt: new Date('2026-02-01'),
          acceptedAt: new Date('2026-03-02'),
          sourcingCost: 1500,
          recruitingCost: 2500,
        }),
        hiringRow({
          id: 'h3',
          openedAt: new Date('2026-03-01'),
          acceptedAt: new Date('2026-03-31'),
          offerStatus: 'declined',
          status: 'closed',
        }),
        hiringRow({
          id: 'h4',
          openedAt: new Date('2026-04-01'),
          acceptedAt: null,
          offerStatus: null,
          status: 'open',
          sourcingCost: null,
          recruitingCost: null,
        }),
      ]);
      const service = new AnalyticsService(
        repo as unknown as AnalyticsRepository,
        rbac as unknown as RbacService,
      );
      const overview = await service.getOverview(actor());

      const pipeline = overview.talent.pipeline!;
      // h1: 30 days, h2: 29 days → avg 29.5; h3 declined and h4 open are excluded.
      expect(pipeline.filledRequisitions).toBe(2);
      expect(pipeline.openRequisitions).toBe(1);
      expect(pipeline.offersSent).toBe(3); // h1 + h2 accepted, h3 declined
      expect(pipeline.averageTimeToHireDays).toBeCloseTo(29.5, 5);
      expect(pipeline.averageCostPerHire).toBe(3500); // (3000 + 4000) / 2
      expect(pipeline.offerAcceptanceRate).toBeCloseTo(2 / 3, 5);
      expect(overview.talent.unavailable).toEqual([]);
    });

    it('lists metrics as unavailable when no pipeline data supports them', async () => {
      const { repo, rbac } = createMocks([row()]);
      repo.getHiringRecords.mockResolvedValue([
        hiringRow({
          id: 'h1',
          acceptedAt: null,
          offerStatus: null,
          status: 'open',
          sourcingCost: null,
          recruitingCost: null,
        }),
      ]);
      const service = new AnalyticsService(
        repo as unknown as AnalyticsRepository,
        rbac as unknown as RbacService,
      );
      const overview = await service.getOverview(actor());

      expect(overview.talent.pipeline!.averageTimeToHireDays).toBeNull();
      expect(overview.talent.pipeline!.averageCostPerHire).toBeNull();
      expect(overview.talent.pipeline!.offerAcceptanceRate).toBeNull();
      expect(overview.talent.unavailable).toEqual([
        'Time-to-hire',
        'Cost-per-hire',
        'Offer acceptance rate',
      ]);
    });

    it('keeps the whole pipeline hidden for managers outside their scope (no rows returned)', async () => {
      const { repo, rbac } = createMocks([row()]);
      rbac.departmentScope.mockResolvedValue(['d1']);
      repo.getHiringRecords.mockResolvedValue([]);
      const service = new AnalyticsService(
        repo as unknown as AnalyticsRepository,
        rbac as unknown as RbacService,
      );
      const overview = await service.getOverview(actor(Role.MANAGER));

      expect(repo.getHiringRecords).toHaveBeenCalledWith(['d1']);
      expect(overview.talent.pipeline!.filledRequisitions).toBe(0);
    });
  });

  describe('talent / hiring', () => {
    it('computes hiring velocity, quality of hire and early attrition from the dataset', async () => {
      const now = Date.now();
      const days = (n: number) => new Date(now - n * 24 * 3600 * 1000);
      mocks.repo.getEmployeeRows.mockResolvedValue([
        // Hired 6 months ago: counts as a recent hire + recent-hire performance.
        row({
          id: 'a',
          departmentId: 'd1',
          hiredAt: days(180),
          performanceRating: 4,
          attrition: false,
        }),
        // Hired 10 days ago: recent + early-tenure (<1 yr) + not attrition.
        row({
          id: 'b',
          departmentId: 'd1',
          hiredAt: days(10),
          performanceRating: 3,
          attrition: false,
        }),
        // Hired 6 months ago in Sales with early attrition.
        row({
          id: 'c',
          departmentId: 'd2',
          hiredAt: days(150),
          performanceRating: 2,
          attrition: true,
          status: 'terminated',
        }),
        // Long-tenured (5 yrs): excluded from hiring windows and early attrition.
        row({
          id: 'd',
          departmentId: 'd2',
          hiredAt: days(365 * 5),
          performanceRating: 3,
          attrition: true,
          status: 'terminated',
        }),
      ]);

      const overview = await service.getOverview(actor());

      expect(overview.talent.recentHires).toBe(3);
      const eng = overview.talent.hiresByDepartment.find((s) => s.name === 'Engineering');
      const sales = overview.talent.hiresByDepartment.find((s) => s.name === 'Sales');
      expect(eng?.value).toBe(2);
      expect(sales?.value).toBe(1);
      // Recent hires with ratings: a(4), b(3), c(2) → avg 3.
      expect(overview.talent.averageRecentHireRating).toBeCloseTo(3, 5);
      expect(overview.talent.recentHirePerformance).toHaveLength(3);
      // Early attrition: <1-yr tenure employees a, b, c → 1 leaver of 3.
      expect(overview.talent.earlyAttrition).toMatchObject({
        headcount: 3,
        attritionCount: 1,
      });
      expect(overview.talent.earlyAttrition.attritionRate).toBeCloseTo(1 / 3, 5);
      // Hiring-pipeline metrics are declared unavailable, never fabricated.
      expect(overview.talent.unavailable).toContain('Time-to-hire');
      expect(overview.talent.unavailable).toContain('Cost-per-hire');
    });

    it('handles an empty dataset without inventing talent metrics', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([]);

      const overview = await service.getOverview(actor());

      expect(overview.talent.recentHires).toBe(0);
      expect(overview.talent.hiresByDepartment).toEqual([]);
      expect(overview.talent.recentHirePerformance).toEqual([]);
      expect(overview.talent.averageRecentHireRating).toBeNull();
      expect(overview.talent.earlyAttrition.attritionRate).toBeNull();
    });
  });

  describe('data quality', () => {
    it('drops the readiness score when core fields are missing and lists them', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([
        row({ id: 'a' }),
        row({ id: 'b', monthlyIncome: null, jobSatisfaction: null }),
      ]);

      const overview = await service.getOverview(actor());

      expect(overview.dataQuality.totalRecords).toBe(2);
      expect(overview.dataQuality.validRecords).toBe(1);
      expect(overview.dataQuality.readinessPercent).toBeLessThan(100);
      const missing = overview.dataQuality.missingFields.map((m) => m.field);
      expect(missing).toContain('monthlyIncome');
      expect(missing).toContain('jobSatisfaction');
    });
  });

  describe('department comparison scoping', () => {
    it('drops out-of-scope department ids for managers (no cross-scope leak)', async () => {
      mocks.rbac.departmentScope.mockResolvedValue(['d1']);
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.repo.getEmployeeRows.mockResolvedValue([row({ id: 'a', departmentId: 'd1' })]);

      const comparison = await service.getCompare(actor(Role.MANAGER), ['d1', 'd9']);

      // Only the in-scope department is compared; the out-of-scope id is gone.
      expect(comparison.map((c) => c.departmentId)).toEqual(['d1']);
      expect(comparison[0]!.headcount).toBe(1);
    });

    it('returns an empty list when a manager requests only out-of-scope ids', async () => {
      mocks.rbac.departmentScope.mockResolvedValue(['d1']);
      mocks.rbac.isAdmin.mockReturnValue(false);

      const comparison = await service.getCompare(actor(Role.MANAGER), ['d9']);

      expect(comparison).toEqual([]);
    });

    it('computes the overtime rate over known values only (KPI convention)', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([
        row({ id: 'a', departmentId: 'd1', overTime: true }),
        row({ id: 'b', departmentId: 'd1', overTime: false }),
        // Records with unknown overtime must not count as "no overtime".
        row({ id: 'c', departmentId: 'd1', overTime: null as unknown as boolean }),
      ]);

      const comparison = await service.getCompare(actor(), ['d1']);

      expect(comparison[0]!.overtimeRate).toBeCloseTo(0.5, 5);
    });

    it('admins can compare any department', async () => {
      mocks.repo.getEmployeeRows.mockResolvedValue([
        row({ id: 'a', departmentId: 'd1' }),
        row({ id: 'b', departmentId: 'd2', attrition: true, status: 'terminated' }),
      ]);

      const comparison = await service.getCompare(actor(), ['d1', 'd2']);

      expect(comparison).toHaveLength(2);
      const sales = comparison.find((c) => c.departmentId === 'd2')!;
      expect(sales.attritionRate).toBeCloseTo(1, 5);
    });

    it('drops unknown department ids instead of fabricating an "Unassigned" row', async () => {
      const comparison = await service.getCompare(actor(), ['d1', 'does-not-exist']);

      expect(comparison.map((c) => c.departmentId)).toEqual(['d1']);
      expect(comparison.every((c) => c.name !== 'Unassigned')).toBe(true);
    });

    it('gates income to null in comparisons for viewers', async () => {
      mocks.rbac.canWrite.mockReturnValue(false);
      mocks.repo.getEmployeeRows.mockResolvedValue([row({ id: 'a', departmentId: 'd1' })]);

      const comparison = await service.getCompare(actor(Role.VIEWER), ['d1']);

      expect(comparison[0]!.averageMonthlyIncome).toBeNull();
      expect(comparison[0]!.headcount).toBe(1);
    });
  });

  describe('filter options', () => {
    it('builds the job-title list from the dedicated distinct query, not every employee row', async () => {
      mocks.repo.getJobTitles.mockResolvedValue(['Engineer', 'Manager']);

      const options = await service.getFilters(actor());

      expect(options.jobTitles).toEqual(['Engineer', 'Manager']);
      expect(mocks.repo.getEmployeeRows).not.toHaveBeenCalled();
    });
  });

  describe('organization hierarchy search', () => {
    it('passes the search term through to the repository', async () => {
      await service.getHierarchy(actor(), 'alex');

      expect(mocks.repo.getHierarchy).toHaveBeenCalledWith(null, 'alex');
    });

    it('trims the term and caps it at 100 characters', async () => {
      await service.getHierarchy(actor(), '   alex   ');
      expect(mocks.repo.getHierarchy).toHaveBeenCalledWith(null, 'alex');

      await service.getHierarchy(actor(), 'x'.repeat(200));
      expect(mocks.repo.getHierarchy).toHaveBeenCalledWith(null, 'x'.repeat(100));
    });
  });
});
