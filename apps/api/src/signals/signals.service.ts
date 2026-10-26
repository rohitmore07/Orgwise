import { Injectable } from '@nestjs/common';
import type { DepartmentTone, LiveSignalsSnapshot } from '@orgwise/types';
import { PrismaService } from '@app/database/prisma.service';

// Live workforce signals — computed from the actual database on every request
// (no hardcoded baselines). The landing page's "Live" dashboard therefore shows
// the same numbers a signed-in user sees. Tones rotate so the frontend never
// has to map unknown departments.
const TONES: DepartmentTone[] = ['indigo', 'cyan', 'emerald', 'violet'];

/** Core engagement fields the data-quality indicator counts as present. */
const CORE_FIELDS = [
  'jobSatisfaction',
  'environmentSatisfaction',
  'relationshipSatisfaction',
  'workLifeBalance',
  'performanceRating',
  'monthlyIncome',
  'education',
  'totalWorkingYears',
] as const;

@Injectable()
export class SignalsService {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async getLiveSnapshot(): Promise<LiveSignalsSnapshot> {
    const now = Date.now();
    const uptimeSeconds = Math.round((now - this.startedAt) / 1000);

    const [employeeRows, departments, teams, hiring, imports, conversations] = await Promise.all([
      this.prisma.employee.findMany({
        where: { deletedAt: null },
        select: {
          departmentId: true,
          attrition: true,
          jobSatisfaction: true,
          environmentSatisfaction: true,
          relationshipSatisfaction: true,
          workLifeBalance: true,
          performanceRating: true,
          monthlyIncome: true,
          education: true,
          totalWorkingYears: true,
        },
      }),
      this.prisma.department.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.team.count({ where: { deletedAt: null } }),
      this.prisma.hiringRecord.count(),
      this.prisma.importHistory.count(),
      this.prisma.aiConversation.count(),
    ]);

    const employees = employeeRows.length;
    const attrited = employeeRows.filter((r) => r.attrition).length;
    const attritionRate = employees === 0 ? 0 : attrited / employees;

    // Engagement: average job satisfaction on a 0–100 scale.
    const satisfactionRows = employeeRows.filter((r) => r.jobSatisfaction !== null);
    const engagementPercent =
      satisfactionRows.length === 0
        ? 0
        : Math.round(
            (satisfactionRows.reduce((sum, r) => sum + (r.jobSatisfaction as number), 0) /
              satisfactionRows.length /
              4) *
              100,
          );

    // Data-quality readiness: % of core engagement fields present.
    const slots = employees * CORE_FIELDS.length;
    const present = employeeRows.reduce(
      (sum, r) => sum + CORE_FIELDS.filter((f) => r[f] !== null).length,
      0,
    );
    const readiness = slots === 0 ? 0 : Math.round((present / slots) * 100);

    // Composite health: data quality + the inverse of observed attrition.
    const healthScore =
      employees === 0 ? 0 : Math.round(readiness * 0.6 + (1 - attritionRate) * 100 * 0.4);

    // Per-department observed attrition + headcount (for heat map, spark, bars).
    const byDept = new Map<
      string,
      { total: number; attrited: number; satisfaction: number; satisfactionCount: number }
    >();
    for (const r of employeeRows) {
      const bucket = byDept.get(r.departmentId) ?? {
        total: 0,
        attrited: 0,
        satisfaction: 0,
        satisfactionCount: 0,
      };
      bucket.total += 1;
      if (r.attrition) bucket.attrited += 1;
      if (r.jobSatisfaction !== null) {
        bucket.satisfaction += r.jobSatisfaction;
        bucket.satisfactionCount += 1;
      }
      byDept.set(r.departmentId, bucket);
    }
    const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

    // Heat map: 48 cells, one per department proportional to headcount share,
    // colored by that department's observed attrition rate.
    const heatCells: number[] = [];
    for (const [, bucket] of byDept) {
      const rate = bucket.total === 0 ? 0 : bucket.attrited / bucket.total;
      const cells = Math.max(2, Math.round((bucket.total / employees) * 48));
      for (let i = 0; i < cells; i += 1) heatCells.push(Math.min(1, rate));
    }
    while (heatCells.length < 48) heatCells.push(0);
    const heatMap = heatCells.slice(0, 48);

    // Department breakdown (top 4 by headcount) + spark series from real data.
    const deptSummaries = [...byDept.entries()]
      .map(([deptId, bucket]) => ({
        name: deptNameById.get(deptId) ?? 'Unassigned',
        total: bucket.total,
        rate: bucket.total === 0 ? 0 : bucket.attrited / bucket.total,
        engagement:
          bucket.satisfactionCount === 0
            ? 0
            : Math.round((bucket.satisfaction / bucket.satisfactionCount / 4) * 100),
      }))
      .sort((a, b) => b.total - a.total);

    const departmentsView = deptSummaries.slice(0, 4).map((d, index) => ({
      name: d.name,
      pct: employees === 0 ? 0 : Math.round((d.total / employees) * 100),
      tone: TONES[index % TONES.length]!,
    }));

    const spark = [
      {
        label: 'Headcount',
        value: employees,
        suffix: '',
        decimals: 0,
        // Real distribution: headcount per department.
        data: deptSummaries.map((d) => d.total),
      },
      {
        label: 'Engagement',
        value: engagementPercent,
        suffix: '%',
        decimals: 0,
        // Real distribution: engagement per department.
        data: deptSummaries.map((d) => d.engagement),
      },
      {
        label: 'Attrition',
        value: attritionRate * 100,
        suffix: '%',
        decimals: 1,
        // Real distribution: observed attrition per department.
        data: deptSummaries.map((d) => Math.round(d.rate * 1000) / 10),
      },
    ];

    const signalsBySource = [
      { source: 'Employee records', count: employees },
      { source: 'Departments', count: departments.length },
      { source: 'Teams', count: teams },
      { source: 'Hiring records', count: hiring },
      { source: 'Imports', count: imports },
      { source: 'Copilot conversations', count: conversations },
    ];

    return {
      generatedAt: new Date(now).toISOString(),
      uptimeSeconds,
      healthScore,
      // No prior period in the current dataset — honest zero delta.
      healthDelta: 0,
      headcount: employees,
      engagementPercent,
      // Observed attrition — labeled as such in the UI, not a prediction.
      flightRiskPercent: Math.round(attritionRate * 1000) / 10,
      signalsTotal: signalsBySource.reduce((sum, s) => sum + s.count, 0),
      signalsBySource,
      modelRefreshedAt: new Date(now).toISOString(),
      departments: departmentsView,
      heatMap,
      spark,
    };
  }
}
