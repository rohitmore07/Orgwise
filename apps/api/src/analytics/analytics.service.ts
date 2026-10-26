import { Injectable } from '@nestjs/common';
import type {
  AnalyticsKpis,
  AnalyticsOverview,
  AttritionBreakdown,
  AttritionSlice,
  CompositionData,
  DashboardFilters,
  DataQuality,
  DepartmentComparison,
  DistributionSlice,
  EngagementData,
  ExecutiveSummary,
  FilterOptions,
  OrgHierarchy,
  TalentData,
  WorkforceInsight,
} from '@orgwise/types';
import { AGE_GROUPS, TENURE_GROUPS } from '@app/common/constants/shared-types.constants';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { RbacService } from '@app/common/services/rbac.service';
import {
  ageGroupOf,
  average,
  formatRate,
  rate,
  tenureGroupOf,
  tenureYears,
} from '@app/common/utils/analytics.util';
import {
  AnalyticsRepository,
  type AnalyticsEmployeeRow,
  type HiringRecordRow,
  type LastImportRow,
} from './analytics.repository';

/** Minimum group size before an attrition pattern is worth reporting. */
const MIN_INSIGHT_GROUP = 5;
/** Server-side cap on how many departments one compare request may ask for. */
const MAX_COMPARE_DEPARTMENTS = 20;
/** Satisfaction dimensions displayed in the engagement section. */
type SatisfactionDimension =
  'jobSatisfaction' | 'environmentSatisfaction' | 'relationshipSatisfaction' | 'workLifeBalance';

const EDUCATION_LABELS: Record<number, string> = {
  1: 'Below College',
  2: 'College',
  3: "Bachelor's",
  4: "Master's",
  5: 'Doctorate',
};

const GENDER_LABELS: Record<string, string> = {
  female: 'Female',
  male: 'Male',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
};
// Workforce-intelligence engine. Every view is computed server-side from ONE scoped employee projection per…
// request (no N+1, no per-chart round trips) and is pure relative to its inputs, so the calculation layer is…
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly rbac: RbacService,
  ) {}

  async getOverview(
    actor: RequestUser,
    filters: DashboardFilters = {},
  ): Promise<AnalyticsOverview> {
    const scope = await this.rbac.departmentScope(actor);
    const incomeVisible = this.rbac.canWrite(actor);

    const [rows, departments, orgCounts, deleted, lastImport, hiringRecords] = await Promise.all([
      this.repo.getEmployeeRows(scope, filters),
      this.repo.getDepartmentNames(scope),
      this.repo.getOrgCounts(scope),
      this.repo.countDeleted(scope),
      this.repo.getLastImport(this.rbac.isAdmin(actor), actor.sub),
      this.repo.getHiringRecords(scope),
    ]);

    const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));
    const kpis = this.computeKpis(rows, orgCounts);
    const attrition = this.computeAttrition(rows, departmentNameById);
    const engagement = this.computeEngagement(rows);
    const talent = this.computeTalent(rows, departmentNameById, hiringRecords);
    const composition = this.computeComposition(rows, departmentNameById);
    const insights = this.generateInsights(rows, kpis, departmentNameById);
    const executiveSummary = this.computeExecutiveSummary(kpis, insights);
    const dataQuality = this.computeDataQuality(rows, deleted, lastImport);

    return {
      kpis: incomeVisible ? kpis : { ...kpis, averageMonthlyIncome: null },
      departments,
      attrition,
      engagement,
      talent,
      composition,
      insights,
      executiveSummary,
      dataQuality,
    };
  }

  /** Department comparison — scope-aware (managers only compare in scope). */
  async getCompare(actor: RequestUser, departmentIds: string[]): Promise<DepartmentComparison[]> {
    const scope = await this.rbac.departmentScope(actor);
    const incomeVisible = this.rbac.canWrite(actor);
    // Cap the input server-side (the UI limits to MAX_COMPARE, but the API
    // must not trust that) and dedupe before spending a query on it.
    const requested = [...new Set(departmentIds.map((id) => id.trim()).filter(Boolean))].slice(
      0,
      MAX_COMPARE_DEPARTMENTS,
    );
    if (requested.length === 0) return [];

    // The manager scope is authoritative: out-of-scope ids are dropped.
    const allowed = scope ? requested.filter((id) => scope.includes(id)) : requested;
    if (allowed.length === 0) return [];

    // Resolve names first so the employee query can be narrowed to exactly the
    // departments being compared — never ship every scoped row for a 2-row table.
    const departments = await this.repo.getDepartmentNames(scope);
    const nameById = new Map(departments.map((d) => [d.id, d.name]));
    // Unknown / deleted ids are silently dropped — never fabricated into a
    // synthetic "Unassigned" comparison row.
    const known = allowed.filter((id) => nameById.has(id));
    if (known.length === 0) return [];

    const rows = await this.repo.getEmployeeRows(scope, {}, known);
    return known.map((id) =>
      this.computeDepartmentComparison(
        rows.filter((r) => r.departmentId === id),
        id,
        nameById.get(id)!,
        incomeVisible,
      ),
    );
  }

  /** Filter-option lists for the global analytics filter bar. */
  async getFilters(actor: RequestUser): Promise<FilterOptions> {
    const scope = await this.rbac.departmentScope(actor);
    const [departments, jobTitles] = await Promise.all([
      this.repo.getDepartmentNames(scope),
      this.repo.getJobTitles(scope),
    ]);
    return {
      departments,
      jobTitles,
      ageGroups: [...AGE_GROUPS],
      tenureGroups: [...TENURE_GROUPS],
      educationLevels: Object.entries(EDUCATION_LABELS).map(([value, label]) => ({
        value: Number(value),
        label,
      })),
    };
  }

  /** Organization hierarchy (departments → teams → employees), optionally filtered server-side by term. */
  async getHierarchy(actor: RequestUser, search?: string): Promise<OrgHierarchy> {
    const scope = await this.rbac.departmentScope(actor);
    return this.repo.getHierarchy(scope, search?.trim().slice(0, 100) || undefined);
  }

  // ── calculations ──────────────────────────────────────────────────────────

  private computeKpis(
    rows: AnalyticsEmployeeRow[],
    orgCounts: { departments: number; managers: number; teams: number },
  ): AnalyticsKpis {
    const totalEmployees = rows.length;
    const activeEmployees = rows.filter((r) => r.status === 'active').length;
    const attritionCount = rows.filter((r) => r.attrition).length;
    const overtimeRows = rows.filter((r) => r.overTime !== null && r.overTime !== undefined);
    const performanceRows = rows.filter((r) => r.performanceRating !== null);

    return {
      totalEmployees,
      activeEmployees,
      attritionRate: rate(attritionCount, totalEmployees),
      averageTenureYears: average(rows.map((r) => tenureYears(r.hiredAt))),
      averageAge: average(
        rows.map((r) =>
          ageGroupOf(r.dateOfBirth) === null ? null : this.ageYearsOf(r.dateOfBirth),
        ),
      ),
      averageMonthlyIncome: average(rows.map((r) => r.monthlyIncome)),
      overtimeRate: rate(overtimeRows.filter((r) => r.overTime).length, overtimeRows.length),
      averagePerformanceRating: average(performanceRows.map((r) => r.performanceRating)),
      totalDepartments: orgCounts.departments,
      totalManagers: orgCounts.managers,
      totalTeams: orgCounts.teams,
      // The dataset is a current snapshot — there is no historical series to compare against, so trends are labelled…
      // as unavailable rather than fabricated.
      snapshot: true,
    };
  }

  private computeAttrition(
    rows: AnalyticsEmployeeRow[],
    deptNameById: Map<string, string>,
  ): AttritionBreakdown {
    const slice = (
      keyFn: (r: AnalyticsEmployeeRow) => string,
      order: string[] = [],
    ): AttritionSlice[] => {
      const groups = new Map<string, { headcount: number; attritionCount: number }>();
      for (const r of rows) {
        const key = keyFn(r);
        const g = groups.get(key) ?? { headcount: 0, attritionCount: 0 };
        g.headcount += 1;
        if (r.attrition) g.attritionCount += 1;
        groups.set(key, g);
      }
      const entries = [...groups.entries()];
      if (order.length > 0) {
        const rank = new Map(order.map((k, i) => [k, i]));
        entries.sort((a, b) => (rank.get(a[0]) ?? 99) - (rank.get(b[0]) ?? 99));
      } else {
        entries.sort((a, b) => b[1].headcount - a[1].headcount);
      }
      return entries.map(([name, g]) => ({
        name,
        headcount: g.headcount,
        attritionCount: g.attritionCount,
        attritionRate: rate(g.attritionCount, g.headcount),
      }));
    };

    return {
      byDepartment: slice((r) => deptNameById.get(r.departmentId) ?? 'Unassigned'),
      byJobRole: slice((r) => r.jobTitle),
      byAgeGroup: slice((r) => ageGroupOf(r.dateOfBirth) ?? 'Unknown', [...AGE_GROUPS, 'Unknown']),
      byTenure: slice((r) => tenureGroupOf(r.hiredAt) ?? 'Unknown', [...TENURE_GROUPS, 'Unknown']),
      byOverTime: slice(
        (r) =>
          r.overTime === undefined || r.overTime === null
            ? 'Unknown'
            : r.overTime
              ? 'Overtime'
              : 'No overtime',
        ['Overtime', 'No overtime', 'Unknown'],
      ),
      byJobSatisfaction: slice(
        (r) => (r.jobSatisfaction ? `Level ${r.jobSatisfaction}` : 'Unknown'),
        ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Unknown'],
      ),
    };
  }

  private computeEngagement(rows: AnalyticsEmployeeRow[]): EngagementData {
    const dimensionSlices = (dim: SatisfactionDimension): DistributionSlice[] => {
      const groups = new Map<number, number>();
      for (const r of rows) {
        const v = r[dim];
        if (typeof v === 'number') groups.set(v, (groups.get(v) ?? 0) + 1);
      }
      return [1, 2, 3, 4]
        .map((level) => ({ name: `Level ${level}`, value: groups.get(level) ?? 0 }))
        .filter((s) => s.value > 0);
    };
    const averageOf = (dim: SatisfactionDimension) => average(rows.map((r) => r[dim]));

    const overtimeRows = rows.filter((r) => r.overTime !== null && r.overTime !== undefined);

    return {
      jobSatisfaction: dimensionSlices('jobSatisfaction'),
      environmentSatisfaction: dimensionSlices('environmentSatisfaction'),
      relationshipSatisfaction: dimensionSlices('relationshipSatisfaction'),
      workLifeBalance: dimensionSlices('workLifeBalance'),
      averageJobSatisfaction: averageOf('jobSatisfaction'),
      averageWorkLifeBalance: averageOf('workLifeBalance'),
      overtimeRate: rate(overtimeRows.filter((r) => r.overTime).length, overtimeRows.length),
    };
  }

  private computeTalent(
    rows: AnalyticsEmployeeRow[],
    deptNameById: Map<string, string>,
    hiring: HiringRecordRow[],
  ): TalentData {
    // Hiring velocity window: hires in the last 12 months.
    const recentHires = rows.filter((r) => {
      const years = tenureYears(r.hiredAt);
      return years !== null && years <= 1;
    });
    // Quality-of-hire proxy window: hires in the last 24 months with a rating.
    const recentHirePerformance = rows.filter((r) => {
      const years = tenureYears(r.hiredAt);
      return years !== null && years <= 2 && r.performanceRating !== null;
    });
    const performanceGroups = new Map<number, number>();
    for (const r of recentHirePerformance) {
      const v = r.performanceRating;
      if (typeof v === 'number') performanceGroups.set(v, (performanceGroups.get(v) ?? 0) + 1);
    }
    const hiresByDepartment = new Map<string, number>();
    for (const r of recentHires) {
      const name = deptNameById.get(r.departmentId) ?? 'Unassigned';
      hiresByDepartment.set(name, (hiresByDepartment.get(name) ?? 0) + 1);
    }

    // Early attrition: observed leavers among <1-year-tenure employees.
    const early = rows.filter((r) => {
      const years = tenureYears(r.hiredAt);
      return years !== null && years < 1;
    });
    const earlyAttritionCount = early.filter((r) => r.attrition).length;

    // ── hiring-pipeline metrics (real HiringRecord rows) ─────────────────────
    const hired = hiring.filter((h) => h.status === 'hired' && h.acceptedAt !== null);
    const timed = hired.filter((h) => h.acceptedAt!.getTime() > h.openedAt.getTime());
    const averageTimeToHireDays =
      timed.length === 0
        ? null
        : average(timed.map((h) => (h.acceptedAt!.getTime() - h.openedAt.getTime()) / 86400000));

    const costed = hired.filter((h) => h.sourcingCost !== null || h.recruitingCost !== null);
    const averageCostPerHire =
      costed.length === 0
        ? null
        : average(costed.map((h) => (h.sourcingCost ?? 0) + (h.recruitingCost ?? 0)));

    const decided = hiring.filter(
      (h) => h.offerStatus === 'accepted' || h.offerStatus === 'declined',
    );
    const accepted = decided.filter((h) => h.offerStatus === 'accepted').length;
    const offerAcceptanceRate = decided.length === 0 ? null : accepted / decided.length;

    const openRequisitions = hiring.filter(
      (h) => h.status === 'open' || h.status === 'in_review' || h.status === 'offer_sent',
    ).length;

    // Dynamic availability: only metrics without supporting rows are listed.
    const unavailable: string[] = [];
    if (averageTimeToHireDays === null) unavailable.push('Time-to-hire');
    if (averageCostPerHire === null) unavailable.push('Cost-per-hire');
    if (offerAcceptanceRate === null) unavailable.push('Offer acceptance rate');

    return {
      recentHires: recentHires.length,
      hiresByDepartment: [...hiresByDepartment.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      recentHirePerformance: [1, 2, 3, 4]
        .map((level) => ({
          name: `Level ${level}`,
          value: performanceGroups.get(level) ?? 0,
        }))
        .filter((s) => s.value > 0),
      averageRecentHireRating: average(recentHirePerformance.map((r) => r.performanceRating)),
      earlyAttrition: {
        headcount: early.length,
        attritionCount: earlyAttritionCount,
        attritionRate: rate(earlyAttritionCount, early.length),
      },
      pipeline: {
        openRequisitions,
        filledRequisitions: hired.length,
        offersSent: decided.length,
        averageTimeToHireDays,
        averageCostPerHire,
        offerAcceptanceRate,
      },
      unavailable,
    };
  }

  private computeComposition(
    rows: AnalyticsEmployeeRow[],
    deptNameById: Map<string, string>,
  ): CompositionData {
    const count = (keyFn: (r: AnalyticsEmployeeRow) => string): DistributionSlice[] => {
      const groups = new Map<string, number>();
      for (const r of rows) {
        const key = keyFn(r);
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      return [...groups.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };
    const ordered = (keyFn: (r: AnalyticsEmployeeRow) => string, order: string[]) => {
      const map = new Map(count(keyFn).map((s) => [s.name, s.value]));
      return order.map((name) => ({ name, value: map.get(name) ?? 0 })).filter((s) => s.value > 0);
    };

    return {
      department: count((r) => deptNameById.get(r.departmentId) ?? 'Unassigned'),
      jobRole: count((r) => r.jobTitle),
      gender: count((r) => GENDER_LABELS[r.gender] ?? 'Unknown'),
      age: ordered((r) => ageGroupOf(r.dateOfBirth) ?? 'Unknown', [...AGE_GROUPS, 'Unknown']),
      education: ordered(
        (r) =>
          r.education ? (EDUCATION_LABELS[r.education] ?? `Level ${r.education}`) : 'Unknown',
        [...Object.values(EDUCATION_LABELS), 'Unknown'],
      ),
      tenure: ordered((r) => tenureGroupOf(r.hiredAt) ?? 'Unknown', [...TENURE_GROUPS, 'Unknown']),
    };
  }
  // Deterministic insight generation. Each insight is an observed pattern with a drill-down that opens the…
  // employee explorer pre-filtered — insights are the start of the journey, not the end of it.
  private generateInsights(
    rows: AnalyticsEmployeeRow[],
    kpis: AnalyticsKpis,
    deptNameById: Map<string, string>,
  ): WorkforceInsight[] {
    const insights: WorkforceInsight[] = [];
    const push = (
      id: string,
      severity: WorkforceInsight['severity'],
      title: string,
      body: string,
      drillDown?: { path: string; params: Record<string, string> },
    ) => {
      insights.push({ id, severity, title, body, drillDown });
    };

    // 1. Highest-attrition department.
    const byDept = new Map<string, AnalyticsEmployeeRow[]>();
    for (const r of rows) {
      const arr = byDept.get(r.departmentId) ?? [];
      arr.push(r);
      byDept.set(r.departmentId, arr);
    }
    const deptRates = [...byDept.entries()]
      .filter(([, arr]) => arr.length >= MIN_INSIGHT_GROUP)
      .map(([id, arr]) => ({
        id,
        name: deptNameById.get(id) ?? 'Unassigned',
        rate: rate(arr.filter((r) => r.attrition).length, arr.length),
      }))
      .filter((d) => d.rate !== null);
    deptRates.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
    const top = deptRates[0];
    if (top && kpis.attritionRate !== null && top.rate! > kpis.attritionRate) {
      push(
        'highest-attrition-department',
        top.rate! > 0.2 ? 'attention' : 'neutral',
        `${top.name} leads observed attrition`,
        `${top.name} shows ${formatRate(top.rate)} attrition versus ${formatRate(kpis.attritionRate)} organization-wide (based on the current dataset).`,
        { path: '/employees', params: { departmentId: top.id, attrition: 'true' } },
      );
    }

    // 2. Overtime correlation.
    const ot = rows.filter((r) => r.overTime === true);
    const noOt = rows.filter((r) => r.overTime === false);
    if (ot.length >= MIN_INSIGHT_GROUP && noOt.length >= MIN_INSIGHT_GROUP) {
      const otRate = rate(ot.filter((r) => r.attrition).length, ot.length);
      const noOtRate = rate(noOt.filter((r) => r.attrition).length, noOt.length);
      if (otRate !== null && noOtRate !== null && otRate > noOtRate + 0.03) {
        push(
          'overtime-correlation',
          'attention',
          'Overtime is associated with higher observed attrition',
          `Employees working overtime show ${formatRate(otRate)} attrition versus ${formatRate(noOtRate)} for those who do not — an observed correlation in the current dataset, worth investigating.`,
          { path: '/employees', params: { overTime: 'true', attrition: 'true' } },
        );
      }
    }

    // 3. Low-satisfaction correlation.
    const low = rows.filter((r) => typeof r.jobSatisfaction === 'number' && r.jobSatisfaction <= 2);
    const high = rows.filter(
      (r) => typeof r.jobSatisfaction === 'number' && r.jobSatisfaction >= 3,
    );
    if (low.length >= MIN_INSIGHT_GROUP && high.length >= MIN_INSIGHT_GROUP) {
      const lowRate = rate(low.filter((r) => r.attrition).length, low.length);
      const highRate = rate(high.filter((r) => r.attrition).length, high.length);
      if (lowRate !== null && highRate !== null && lowRate > highRate + 0.03) {
        push(
          'satisfaction-correlation',
          'attention',
          'Lower job satisfaction tracks with higher observed attrition',
          `Employees rating job satisfaction 1–2 show ${formatRate(lowRate)} attrition versus ${formatRate(highRate)} for those rating 3–4 — an observed correlation, not a prediction.`,
          { path: '/employees', params: { jobSatisfaction: '1', attrition: 'true' } },
        );
      }
    }

    // 4. Long-tenure concentration.
    const longTenure = rows.filter((r) => (tenureYears(r.hiredAt) ?? 0) >= 5);
    if (longTenure.length >= MIN_INSIGHT_GROUP) {
      const pct = rate(longTenure.length, rows.length);
      push(
        'long-tenure-share',
        pct !== null && pct >= 0.35 ? 'positive' : 'neutral',
        `${formatRate(pct, 0)} of the workforce has 5+ years of tenure`,
        `${longTenure.length} employees have been here five years or longer — a strong base of institutional knowledge.`,
        { path: '/employees', params: { tenureGroup: '6-10' } },
      );
    }
    // 5. Largest department by headcount — computed independently of attrition
    // (an insight about size must not be derived from the attrition ranking).
    const largestBySize = [...byDept.entries()]
      .map(([id, arr]) => ({ id, name: deptNameById.get(id) ?? 'Unassigned', size: arr.length }))
      .sort((a, b) => b.size - a.size)[0];
    if (largestBySize) {
      const pct = rate(largestBySize.size, rows.length);
      push(
        'largest-department',
        'neutral',
        `${largestBySize.name} is the largest department`,
        `${largestBySize.name} holds ${largestBySize.size} employees — ${formatRate(pct, 0)} of headcount.`,
        { path: '/employees', params: { departmentId: largestBySize.id } },
      );
    }

    // 6. Overtime prevalence (healthy when low).
    if (kpis.overtimeRate !== null) {
      push(
        'overtime-prevalence',
        kpis.overtimeRate <= 0.35 ? 'positive' : 'attention',
        `${formatRate(kpis.overtimeRate, 0)} of employees work overtime`,
        kpis.overtimeRate <= 0.35
          ? 'Overtime is the exception rather than the norm — a healthy workload signal.'
          : 'A notable share of the workforce works overtime — a potential sustainability risk worth reviewing.',
        { path: '/employees', params: { overTime: 'true' } },
      );
    }

    return insights.slice(0, 6);
  }
  // Deterministic executive summary — a stable, explainable headline derived from the observed KPIs, plus the top…
  // attention areas from the insights.
  private computeExecutiveSummary(
    kpis: AnalyticsKpis,
    insights: WorkforceInsight[],
  ): ExecutiveSummary {
    let status: ExecutiveSummary['status'] = 'stable';
    if (kpis.attritionRate === null) {
      status = 'stable';
    } else if (kpis.attritionRate < 0.12) {
      status = 'healthy';
    } else if (kpis.attritionRate >= 0.2) {
      status = 'attention';
    }
    if (status !== 'attention' && (kpis.overtimeRate ?? 0) > 0.4) status = 'attention';

    const rateText =
      kpis.attritionRate === null
        ? 'no attrition data available yet'
        : `observed attrition of ${formatRate(kpis.attritionRate)}`;
    const headline =
      status === 'healthy'
        ? `Workforce health is healthy — ${kpis.totalEmployees} employees with ${rateText}.`
        : status === 'attention'
          ? `Workforce health needs attention — ${rateText} and the following patterns stand out.`
          : `Workforce health is stable — ${kpis.totalEmployees} employees with ${rateText}.`;

    const keyAreas = insights
      .filter((i) => i.severity === 'attention')
      .slice(0, 3)
      .map((i) => i.title);
    // A healthy org still surfaces its largest group / top pattern for context.
    if (keyAreas.length === 0) {
      const first = insights.find((i) => i.severity === 'positive' || i.severity === 'neutral');
      if (first) keyAreas.push(first.title);
    }

    return { status, headline, keyAreas, updatedAt: new Date().toISOString() };
  }

  private computeDataQuality(
    rows: AnalyticsEmployeeRow[],
    deleted: number,
    lastImport: LastImportRow | null,
  ): DataQuality {
    // A record is analytics-ready when it carries the core engagement fields the engine reads; records created…
    // before Phase 4 or from minimal CSVs lower the readiness score instead of being silently assumed complete.
    const coreFields: Array<{ field: string; label: string }> = [
      { field: 'jobSatisfaction', label: 'Job satisfaction' },
      { field: 'environmentSatisfaction', label: 'Environment satisfaction' },
      { field: 'relationshipSatisfaction', label: 'Relationship satisfaction' },
      { field: 'workLifeBalance', label: 'Work-life balance' },
      { field: 'performanceRating', label: 'Performance rating' },
      { field: 'monthlyIncome', label: 'Monthly income' },
      { field: 'education', label: 'Education' },
      { field: 'totalWorkingYears', label: 'Total working years' },
    ];

    const missingFields: DataQuality['missingFields'] = [];
    let present = 0;
    let valid = 0;
    for (const r of rows) {
      let allCore = true;
      for (const { field, label } of coreFields) {
        const value = r[field as keyof AnalyticsEmployeeRow];
        if (value === null || value === undefined) {
          missingFields.push({ field, label, count: 1 });
          allCore = false;
        } else {
          present += 1;
        }
      }
      if (allCore) valid += 1;
    }

    const totals = rows.length * coreFields.length;
    const readinessPercent = totals === 0 ? 0 : Math.round((present / totals) * 100);

    // Aggregate missing counts and sort by severity.
    const aggregated = new Map<string, DataQuality['missingFields'][number]>();
    for (const m of missingFields) {
      const existing = aggregated.get(m.field);
      if (existing) existing.count += 1;
      else aggregated.set(m.field, { ...m });
    }
    const missing = [...aggregated.values()].sort((a, b) => b.count - a.count);

    return {
      totalRecords: rows.length,
      validRecords: valid,
      readinessPercent,
      missingFields: missing,
      // Unique indexes make duplicates impossible — reported for transparency.
      duplicateRecords: 0,
      deletedRecords: deleted,
      lastImport: lastImport
        ? {
            id: lastImport.id,
            fileName: lastImport.fileName,
            status: lastImport.status,
            totalRows: lastImport.totalRows,
            successCount: lastImport.successCount,
            failedCount: lastImport.failedCount,
            createdAt: lastImport.createdAt.toISOString(),
          }
        : null,
    };
  }

  private computeDepartmentComparison(
    rows: AnalyticsEmployeeRow[],
    departmentId: string,
    name: string,
    incomeVisible: boolean,
  ): DepartmentComparison {
    const attritionRows = rows.filter((r) => r.attrition).length;
    // Overtime rate uses the same convention as the KPI: only records with a known overtime value count toward the…
    // denominator, so a department with missing overtime data is not treated as "no overtime".
    const overtimeKnown = rows.filter((r) => r.overTime !== null && r.overTime !== undefined);
    const satisfactionValues = rows
      .map((r) => r.jobSatisfaction)
      .filter((v): v is number => typeof v === 'number');
    return {
      departmentId,
      name,
      headcount: rows.length,
      attritionRate: rate(attritionRows, rows.length),
      averageTenureYears: average(rows.map((r) => tenureYears(r.hiredAt))),
      averageMonthlyIncome: incomeVisible ? average(rows.map((r) => r.monthlyIncome)) : null,
      overtimeRate: rate(overtimeKnown.filter((r) => r.overTime).length, overtimeKnown.length),
      averageJobSatisfaction: average(satisfactionValues),
      averagePerformanceRating: average(rows.map((r) => r.performanceRating)),
    };
  }

  /** Compare workforce metrics across two time periods. Uses hiredAt for period membership. */
  async comparePeriods(
    actor: RequestUser,
    dto: {
      currentStart: string;
      currentEnd: string;
      previousStart?: string;
      previousEnd?: string;
      departmentId?: string;
    },
  ): Promise<import('@orgwise/types').PeriodComparison> {
    const scope = await this.rbac.departmentScope(actor);
    const incomeVisible = this.rbac.canWrite(actor);

    const currentStart = new Date(dto.currentStart);
    const currentEnd = new Date(dto.currentEnd);
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = dto.previousEnd
      ? new Date(dto.previousEnd)
      : new Date(currentStart.getTime() - 86400000);
    const previousStart = dto.previousStart
      ? new Date(dto.previousStart)
      : new Date(previousEnd.getTime() - durationMs);

    const allRows = await this.repo.getEmployeeRows(
      scope,
      dto.departmentId ? { departmentId: dto.departmentId } : {},
    );

    const compute = (start: Date, end: Date) => {
      // Employees who were hired on or before period end (i.e. present during the period).
      const present = allRows.filter((r) => r.hiredAt <= end);
      const attrited = present.filter((r) => r.attrition === true);
      const newHires = allRows.filter((r) => r.hiredAt >= start && r.hiredAt <= end);
      const overtimeKnown = present.filter((r) => r.overTime !== null && r.overTime !== undefined);
      const satKnown = present.filter((r) => (r.jobSatisfaction ?? 0) > 0);

      return {
        headcount: present.length,
        attritionCount: attrited.length,
        attritionRate: formatRate(rate(attrited.length, present.length)),
        averageTenure: formatRate(null) as string, // placeholder — filled below
        averageIncome: incomeVisible ? (average(present.map((r) => r.monthlyIncome)) ?? 0) : 0,
        overtimeRate: formatRate(
          rate(overtimeKnown.filter((r) => r.overTime).length, overtimeKnown.length),
        ),
        averageSatisfaction: (average(satKnown.map((r) => r.jobSatisfaction ?? 0)) ?? 0).toFixed(1),
        newHires: newHires.length,
        activeCount: present.length,
      };
    };

    const current = compute(currentStart, currentEnd);
    const previous = compute(previousStart, previousEnd);

    // Compute average tenure as a display string.
    const avgTenure = (rows: typeof allRows) => {
      const vals = rows.map((r) => tenureYears(r.hiredAt));
      const avg = average(vals);
      return avg !== null ? avg.toFixed(1) : '0.0';
    };
    const currPresent = allRows.filter((r) => r.hiredAt <= currentEnd);
    const prevPresent = allRows.filter((r) => r.hiredAt <= previousEnd);
    current.averageTenure = avgTenure(currPresent);
    previous.averageTenure = avgTenure(prevPresent);

    return {
      current,
      previous,
      deltas: {
        headcount: current.headcount - previous.headcount,
        attritionRate:
          (parseFloat(current.attritionRate) - parseFloat(previous.attritionRate)).toFixed(1) + '%',
        averageTenure: (
          parseFloat(current.averageTenure) - parseFloat(previous.averageTenure)
        ).toFixed(1),
        overtimeRate:
          (parseFloat(current.overtimeRate) - parseFloat(previous.overtimeRate)).toFixed(1) + '%',
        averageSatisfaction: (
          parseFloat(current.averageSatisfaction) - parseFloat(previous.averageSatisfaction)
        ).toFixed(1),
        newHires: current.newHires - previous.newHires,
      },
      currentPeriod: { start: dto.currentStart, end: dto.currentEnd },
      previousPeriod: {
        start: previousStart.toISOString().slice(0, 10),
        end: previousEnd.toISOString().slice(0, 10),
      },
    };
  }

  private ageYearsOf(dateOfBirth: Date | null): number | null {
    if (!dateOfBirth) return null;
    const ms = Date.now() - dateOfBirth.getTime();
    return ms >= 0 ? ms / (365.25 * 24 * 3600 * 1000) : null;
  }
}
