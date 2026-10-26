import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database/prisma.service';
import { SignalsService } from './signals.service';

function createPrismaMock(): PrismaService {
  const employeeRows = [
    {
      departmentId: 'd1',
      attrition: false,
      jobSatisfaction: 3,
      environmentSatisfaction: 3,
      relationshipSatisfaction: 3,
      workLifeBalance: 3,
      performanceRating: 3,
      monthlyIncome: 8000,
      education: 3,
      totalWorkingYears: 8,
    },
    {
      departmentId: 'd1',
      attrition: true,
      jobSatisfaction: 1,
      environmentSatisfaction: 2,
      relationshipSatisfaction: 2,
      workLifeBalance: 2,
      performanceRating: 2,
      monthlyIncome: 6000,
      education: 2,
      totalWorkingYears: 4,
    },
    {
      departmentId: 'd2',
      attrition: false,
      jobSatisfaction: 4,
      environmentSatisfaction: 4,
      relationshipSatisfaction: 4,
      workLifeBalance: 4,
      performanceRating: 4,
      monthlyIncome: 12000,
      education: 4,
      totalWorkingYears: 12,
    },
    {
      departmentId: 'd2',
      attrition: false,
      jobSatisfaction: 2,
      environmentSatisfaction: 3,
      relationshipSatisfaction: 3,
      workLifeBalance: 3,
      performanceRating: 3,
      monthlyIncome: 7000,
      education: 3,
      totalWorkingYears: 6,
    },
    {
      departmentId: 'd2',
      attrition: false,
      jobSatisfaction: 3,
      environmentSatisfaction: 3,
      relationshipSatisfaction: 3,
      workLifeBalance: 3,
      performanceRating: 3,
      monthlyIncome: 9000,
      education: 3,
      totalWorkingYears: 7,
    },
  ];
  return {
    employee: {
      findMany: jest.fn().mockResolvedValue(employeeRows),
    },
    department: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'd1', name: 'Engineering' },
        { id: 'd2', name: 'Sales' },
      ]),
    },
    team: { count: jest.fn().mockResolvedValue(3) },
    hiringRecord: { count: jest.fn().mockResolvedValue(4) },
    importHistory: { count: jest.fn().mockResolvedValue(2) },
    aiConversation: { count: jest.fn().mockResolvedValue(1) },
  } as unknown as PrismaService;
}

describe('SignalsService', () => {
  let service: SignalsService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [SignalsService, { provide: PrismaService, useValue: createPrismaMock() }],
    }).compile();

    service = moduleRef.get<SignalsService>(SignalsService);
  });

  describe('getLiveSnapshot', () => {
    it('computes a well-formed snapshot from real data', async () => {
      const snapshot = await service.getLiveSnapshot();

      expect(snapshot.generatedAt).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(snapshot.generatedAt))).toBe(false);
      expect(snapshot.healthScore).toBeGreaterThanOrEqual(0);
      expect(snapshot.healthScore).toBeLessThanOrEqual(100);
      expect(snapshot.signalsTotal).toBeGreaterThan(0);
      expect(snapshot.signalsBySource.length).toBeGreaterThan(1);
      expect(snapshot.departments.length).toBeGreaterThan(0);
      expect(snapshot.heatMap.length).toBe(48);
      expect(snapshot.heatMap.every((cell) => cell >= 0 && cell <= 1)).toBe(true);
      expect(snapshot.spark.length).toBe(3);
    });

    it('derives metrics from the imported records rather than hardcoded baselines', async () => {
      const snapshot = await service.getLiveSnapshot();

      // 5 employees, 1 attrited → observed attrition 20%.
      expect(snapshot.headcount).toBe(5);
      expect(snapshot.flightRiskPercent).toBe(20);
      // Average satisfaction (3+1+4+2+3)/5 = 2.6 → 65% on a 0–100 scale.
      expect(snapshot.engagementPercent).toBe(65);
      // Readiness: all 8 core fields present on all 5 rows → 100%.
      expect(snapshot.healthScore).toBe(Math.round(100 * 0.6 + 80 * 0.4));
      // Real data-source rows, not Workday/Slack.
      expect(snapshot.signalsBySource.map((s) => s.source)).toEqual([
        'Employee records',
        'Departments',
        'Teams',
        'Hiring records',
        'Imports',
        'Copilot conversations',
      ]);
      // Department breakdown from real headcounts (Engineering 2, Sales 3).
      const sales = snapshot.departments.find((d) => d.name === 'Sales');
      expect(sales?.pct).toBe(60);
    });

    it('reports a zero delta because the dataset has no prior period', async () => {
      const snapshot = await service.getLiveSnapshot();
      expect(snapshot.healthDelta).toBe(0);
    });
  });
});
