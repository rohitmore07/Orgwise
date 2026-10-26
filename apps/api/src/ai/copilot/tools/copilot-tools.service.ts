import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Joi from 'joi';
import type {
  AgeGroup,
  AnalyticsOverview,
  CompositionData,
  CopilotDeepLink,
  EmployeeView,
  EngagementData,
  FilterOptions,
  ImportHistoryView,
  TenureGroup,
} from '@orgwise/types';
import { AGE_GROUPS, TENURE_GROUPS } from '@app/common/constants/shared-types.constants';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { AnalyticsService } from '@app/analytics/analytics.service';
import { EmployeesService } from '@app/employees/employees.service';
import { ImportsService } from '@app/imports/imports.service';
import type { CopilotTool, CopilotToolExecution } from '../copilot.types';

/** Max slices forwarded per distribution so tool payloads stay small. */
const MAX_SLICES = 8;
/** Max employees returned by the search tool. */
const MAX_SEARCH_LIMIT = 25;
// Controlled analytics tools — the ONLY way the LLM touches workforce data. Authorization is inherited by…
// construction: every tool forwards the actor into the existing RBAC-scoped services (`AnalyticsService`,…
@Injectable()
export class CopilotToolsService {
  private readonly logger = new Logger(CopilotToolsService.name);

  readonly tools: CopilotTool[];

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly employees: EmployeesService,
    private readonly imports: ImportsService,
  ) {
    this.tools = [
      {
        name: 'getWorkforceOverview',
        description:
          'Headline workforce KPIs (headcount, active employees, attrition rate, average tenure/age/income, overtime rate, performance) plus the executive summary and dataset-health snapshot. Use for "how many employees", "what is our attrition/tenure/income".',
        isAvailable: () => true,
        inputSchema: Joi.object({}).options({ stripUnknown: true }),
        execute: (user) => this.getWorkforceOverview(user),
      },
      {
        name: 'getAttritionAnalysis',
        description:
          'Observed attrition broken down by department, job role, age group, tenure, overtime and job satisfaction. Optional departmentName narrows to one department. Use for "which department/role has the highest attrition", "how does overtime relate to attrition".',
        isAvailable: () => true,
        inputSchema: Joi.object({ departmentName: Joi.string().trim().max(80) }).options({
          stripUnknown: true,
        }),
        execute: (user, args) =>
          this.getAttritionAnalysis(user, args as { departmentName?: string }),
      },
      {
        name: 'getEngagementMetrics',
        description:
          'Engagement & culture: job/environment/relationship satisfaction and work-life balance distributions (levels 1-4) plus averages and overtime rate. Use for "how engaged is the workforce", "job satisfaction by department".',
        isAvailable: () => true,
        inputSchema: Joi.object({ departmentName: Joi.string().trim().max(80) }).options({
          stripUnknown: true,
        }),
        execute: (user, args) =>
          this.getEngagementMetrics(user, args as { departmentName?: string }),
      },
      {
        name: 'getWorkforceComposition',
        description:
          'Workforce composition: headcount distribution by department, job role, gender, age group, education and tenure. Use for "what does the workforce look like", "largest department/role".',
        isAvailable: () => true,
        inputSchema: Joi.object({ departmentName: Joi.string().trim().max(80) }).options({
          stripUnknown: true,
        }),
        execute: (user, args) =>
          this.getWorkforceComposition(user, args as { departmentName?: string }),
      },
      {
        name: 'compareDepartments',
        description:
          'Side-by-side comparison of 2-5 departments: headcount, attrition rate, average tenure, average income (role-gated), overtime rate, job satisfaction, performance. Use for "compare Engineering and Sales", "which department has better satisfaction".',
        isAvailable: () => true,
        inputSchema: Joi.object({
          departmentNames: Joi.array().items(Joi.string().trim().max(80)).min(2).max(5).required(),
        }).options({ stripUnknown: true }),
        execute: (user, args) =>
          this.compareDepartments(user, args as { departmentNames: string[] }),
      },
      {
        name: 'getDepartmentMetrics',
        description:
          'Detailed metrics for ONE department (headcount, attrition, tenure, income, overtime, satisfaction, performance). Use when the user asks about a single department.',
        isAvailable: () => true,
        inputSchema: Joi.object({ departmentName: Joi.string().trim().max(80).required() }).options(
          {
            stripUnknown: true,
          },
        ),
        execute: (user, args) =>
          this.getDepartmentMetrics(user, args as { departmentName: string }),
      },
      {
        name: 'searchEmployees',
        description:
          'Search employee records with filters (name/title search, department, job title, overtime, attrition, job satisfaction level, tenure group, age group). Returns a compact list — never salary. Use for "show me employees in Sales working overtime", "find employees with low satisfaction".',
        isAvailable: () => true,
        inputSchema: Joi.object({
          search: Joi.string().trim().max(100),
          departmentName: Joi.string().trim().max(80),
          jobTitle: Joi.string().trim().max(80),
          overTime: Joi.boolean(),
          attrition: Joi.boolean(),
          jobSatisfaction: Joi.number().integer().min(1).max(4),
          tenureGroup: Joi.string().valid(...TENURE_GROUPS),
          ageGroup: Joi.string().valid(...AGE_GROUPS),
          limit: Joi.number().integer().min(1).max(MAX_SEARCH_LIMIT).default(10),
        }).options({ stripUnknown: true }),
        execute: (user, args) => this.searchEmployees(user, args as Record<string, unknown>),
      },
      {
        name: 'getEmployeeDetails',
        description:
          'Full profile for ONE employee by id (from searchEmployees results). Includes engagement profile; salary is role-gated server-side. Use for "tell me about employee X".',
        isAvailable: () => true,
        inputSchema: Joi.object({ employeeId: Joi.string().trim().max(64).required() }).options({
          stripUnknown: true,
        }),
        execute: (user, args) => this.getEmployeeDetails(user, args as { employeeId: string }),
      },
      {
        name: 'getDataQuality',
        description:
          'Dataset-health indicator: total/valid records, readiness percent, missing fields, duplicates, last import. Use for "how good is our data", "data quality".',
        isAvailable: () => true,
        inputSchema: Joi.object({}).options({ stripUnknown: true }),
        execute: (user) => this.getDataQuality(user),
      },
      {
        name: 'getImportHistory',
        description:
          'Recent CSV import history (file name, status, rows processed/successful/failed, duplicates, duration, importer). Admins see all imports; others see only their own. Use for "import history", "when was data last imported".',
        isAvailable: () => true,
        inputSchema: Joi.object({
          limit: Joi.number().integer().min(1).max(10).default(5),
        }).options({
          stripUnknown: true,
        }),
        execute: (user, args) => this.getImportHistory(user, args as { limit?: number }),
      },
    ];
  }

  /** Tool lookup by name — the service validates names against this registry. */
  find(name: string): CopilotTool | undefined {
    return this.tools.find((t) => t.name === name);
  }

  /** All tools available to the actor (used to build the planning prompt). */
  availableFor(user: RequestUser): CopilotTool[] {
    return this.tools.filter((t) => t.isAvailable(user));
  }

  /** Scope-aware context handed to the planning LLM (department names only). */
  async buildPlanningContext(user: RequestUser): Promise<{ departments: string[] }> {
    const filters = await this.analytics.getFilters(user);
    return { departments: filters.departments.map((d) => d.name) };
  }

  // ── tool implementations ───────────────────────────────────────────────────

  private async getWorkforceOverview(user: RequestUser): Promise<CopilotToolExecution> {
    const overview = await this.analytics.getOverview(user);
    return {
      data: {
        kpis: overview.kpis,
        executiveSummary: overview.executiveSummary,
        dataQuality: {
          totalRecords: overview.dataQuality.totalRecords,
          readinessPercent: overview.dataQuality.readinessPercent,
          lastImport: overview.dataQuality.lastImport,
        },
      },
      deepLinks: [{ label: 'Open the analytics dashboard', href: '/dashboard' }],
      recordsAnalyzed: overview.dataQuality.totalRecords,
      lastImportedAt: overview.dataQuality.lastImport?.createdAt,
      suggestions: [
        'Which department has the highest observed attrition?',
        'How does overtime relate to attrition?',
        'What does the workforce composition look like?',
      ],
    };
  }

  private async getAttritionAnalysis(
    user: RequestUser,
    args: { departmentName?: string },
  ): Promise<CopilotToolExecution> {
    const { departmentId, overview, unresolved } = await this.overviewFor(
      user,
      args.departmentName,
    );
    return {
      data: {
        ...(unresolved ? { unresolvedDepartment: unresolved } : {}),
        overallAttritionRate: overview.kpis.attritionRate,
        byDepartment: trimSlices(overview.attrition.byDepartment),
        byJobRole: trimSlices(overview.attrition.byJobRole),
        byAgeGroup: trimSlices(overview.attrition.byAgeGroup),
        byTenure: trimSlices(overview.attrition.byTenure),
        byOverTime: trimSlices(overview.attrition.byOverTime),
        byJobSatisfaction: trimSlices(overview.attrition.byJobSatisfaction),
        // Explicitly labelled: these are observed correlations, not causes.
        note: 'Attrition slices are observed rates from the current dataset — correlation, not causation.',
      },
      deepLinks: [
        {
          label: 'View employees with observed attrition',
          href: employeeHref({ attrition: 'true', departmentId }),
        },
      ],
      recordsAnalyzed: overview.dataQuality.totalRecords,
      lastImportedAt: overview.dataQuality.lastImport?.createdAt,
      limitations: unresolved ? [`${unresolved} is not in your access scope.`] : undefined,
      suggestions: [
        departmentId
          ? `Which job roles in ${args.departmentName} have the highest attrition?`
          : 'Which job roles have the highest observed attrition?',
        'How does overtime relate to attrition?',
        'Show me employees in the highest-risk group.',
      ],
    };
  }

  private async getEngagementMetrics(
    user: RequestUser,
    args: { departmentName?: string },
  ): Promise<CopilotToolExecution> {
    const { departmentId, overview, unresolved } = await this.overviewFor(
      user,
      args.departmentName,
    );
    return {
      data: {
        ...(unresolved ? { unresolvedDepartment: unresolved } : {}),
        engagement: trimEngagement(overview.engagement),
      },
      deepLinks: [
        {
          label: 'Open engagement analytics',
          href: `/dashboard${departmentId ? `?departmentId=${departmentId}` : ''}`,
        },
      ],
      recordsAnalyzed: overview.dataQuality.totalRecords,
      lastImportedAt: overview.dataQuality.lastImport?.createdAt,
      limitations: unresolved ? [`${unresolved} is not in your access scope.`] : undefined,
      suggestions: [
        'How does job satisfaction relate to attrition?',
        'Which departments have the lowest work-life balance?',
        'Compare job satisfaction across departments.',
      ],
    };
  }

  private async getWorkforceComposition(
    user: RequestUser,
    args: { departmentName?: string },
  ): Promise<CopilotToolExecution> {
    const { departmentId, overview, unresolved } = await this.overviewFor(
      user,
      args.departmentName,
    );
    return {
      data: {
        ...(unresolved ? { unresolvedDepartment: unresolved } : {}),
        composition: trimComposition(overview.composition),
        totalEmployees: overview.kpis.totalEmployees,
      },
      deepLinks: [
        {
          label: 'Open composition analytics',
          href: `/dashboard${departmentId ? `?departmentId=${departmentId}` : ''}`,
        },
      ],
      recordsAnalyzed: overview.dataQuality.totalRecords,
      lastImportedAt: overview.dataQuality.lastImport?.createdAt,
      limitations: unresolved ? [`${unresolved} is not in your access scope.`] : undefined,
      suggestions: [
        'Which department is the largest?',
        'What is the tenure distribution of the workforce?',
        'How does composition vary by gender?',
      ],
    };
  }

  private async compareDepartments(
    user: RequestUser,
    args: { departmentNames: string[] },
  ): Promise<CopilotToolExecution> {
    const filters = await this.analytics.getFilters(user);
    const resolved = resolveDepartments(filters, args.departmentNames);
    const unresolved = args.departmentNames.filter(
      (name) => !resolved.some((r) => r.name === name),
    );

    const comparison = await this.analytics.getCompare(
      user,
      resolved.map((r) => r.id),
    );
    return {
      data: {
        ...(unresolved.length > 0
          ? {
              unresolvedDepartments: unresolved,
              note: 'These departments were not found in the accessible scope and were excluded.',
            }
          : {}),
        comparison,
      },
      deepLinks: resolved.map((r): CopilotDeepLink => ({
        label: `View ${r.name} analytics`,
        href: `/dashboard?departmentId=${r.id}`,
      })),
      recordsAnalyzed: comparison.reduce((sum, c) => sum + c.headcount, 0),
      limitations:
        unresolved.length > 0
          ? unresolved.map((name) => `${name} is not in your access scope and was excluded.`)
          : undefined,
      suggestions: [
        'Which department has the highest observed attrition?',
        'Compare job satisfaction across departments.',
        'Show me the employees behind the highest attrition department.',
      ],
    };
  }

  private async getDepartmentMetrics(
    user: RequestUser,
    args: { departmentName: string },
  ): Promise<CopilotToolExecution> {
    const filters = await this.analytics.getFilters(user);
    const match = findDepartment(filters, args.departmentName);
    if (!match) {
      return {
        data: {
          unresolvedDepartment: args.departmentName,
          note: 'Department not found in the accessible scope.',
        },
        deepLinks: [],
        limitations: [`${args.departmentName} is not in your access scope.`],
        suggestions: ['Which departments can I see?', 'Compare the departments I can access.'],
      };
    }
    const [comparison] = await this.analytics.getCompare(user, [match.id]);
    return {
      data: { department: comparison },
      deepLinks: [
        { label: `View ${match.name} analytics`, href: `/dashboard?departmentId=${match.id}` },
        { label: `View ${match.name} employees`, href: `/employees?departmentId=${match.id}` },
      ],
      recordsAnalyzed: comparison?.headcount,
      suggestions: [
        `Which job roles in ${match.name} have the highest attrition?`,
        'How does overtime relate to attrition?',
        'Compare this department with another.',
      ],
    };
  }

  private async searchEmployees(
    user: RequestUser,
    args: Record<string, unknown>,
  ): Promise<CopilotToolExecution> {
    const filters = await this.analytics.getFilters(user);
    const departmentName = (args.departmentName as string | undefined)?.trim();
    const match = departmentName ? findDepartment(filters, departmentName) : undefined;
    const unresolved = departmentName && !match ? departmentName : undefined;

    const result = await this.employees.findAll(user, {
      page: 1,
      pageSize: (args.limit as number) ?? 10,
      search: args.search as string | undefined,
      departmentId: match?.id,
      jobTitle: args.jobTitle as string | undefined,
      overTime: args.overTime as boolean | undefined,
      attrition: args.attrition as boolean | undefined,
      jobSatisfaction: args.jobSatisfaction as number | undefined,
      tenureGroup: args.tenureGroup as TenureGroup | undefined,
      ageGroup: args.ageGroup as AgeGroup | undefined,
      sortBy: 'firstName',
      sortOrder: 'asc',
    });

    return {
      data: {
        ...(unresolved ? { unresolvedDepartment: unresolved } : {}),
        total: result.total,
        returned: result.items.length,
        employees: result.items.map(compactEmployee),
      },
      limitations: unresolved ? [`${unresolved} is not in your access scope.`] : undefined,
      deepLinks: [
        {
          label: 'Open these employees in the explorer',
          href: employeeHref({
            search: args.search as string | undefined,
            departmentId: match?.id,
            overTime: args.overTime as boolean | undefined,
            attrition: args.attrition as boolean | undefined,
            jobSatisfaction: args.jobSatisfaction as number | undefined,
            tenureGroup: args.tenureGroup as TenureGroup | undefined,
            ageGroup: args.ageGroup as AgeGroup | undefined,
          }),
        },
      ],
      recordsAnalyzed: result.total,
      suggestions: [
        'Which of these employees have the highest attrition risk signals?',
        'What does the attrition look like for this group?',
        'Show me a similar group in another department.',
      ],
    };
  }

  private async getEmployeeDetails(
    user: RequestUser,
    args: { employeeId: string },
  ): Promise<CopilotToolExecution> {
    let employee: EmployeeView;
    try {
      employee = await this.employees.findOne(user, args.employeeId);
    } catch (error) {
      // Out-of-scope and unknown ids are indistinguishable on purpose (opaque
      // NotFound) — surface a truthful limitation instead of an error.
      if (error instanceof NotFoundException) {
        return {
          data: {
            notFound: args.employeeId,
            note: 'Employee not found or outside the accessible scope.',
          },
          deepLinks: [],
          limitations: ['Employee not found or outside the accessible scope.'],
          suggestions: ['Search for employees by name', 'Show me the employees in my scope.'],
        };
      }
      throw error;
    }
    return {
      data: { employee: compactEmployee(employee) },
      deepLinks: [
        {
          label: `Open ${employee.firstName} ${employee.lastName}'s profile`,
          href: `/employees/${employee.id}`,
        },
      ],
      recordsAnalyzed: 1,
      suggestions: [
        'Show me the observed attrition patterns in their department.',
        'Search for similar employees in the same department.',
        'What are the engagement metrics for this employee?',
      ],
    };
  }

  private async getDataQuality(user: RequestUser): Promise<CopilotToolExecution> {
    const overview = await this.analytics.getOverview(user);
    return {
      data: {
        totalRecords: overview.dataQuality.totalRecords,
        validRecords: overview.dataQuality.validRecords,
        readinessPercent: overview.dataQuality.readinessPercent,
        missingFields: overview.dataQuality.missingFields.slice(0, MAX_SLICES),
        duplicateRecords: overview.dataQuality.duplicateRecords,
        lastImport: overview.dataQuality.lastImport,
      },
      deepLinks: [{ label: 'Open import history', href: '/imports' }],
      recordsAnalyzed: overview.dataQuality.totalRecords,
      lastImportedAt: overview.dataQuality.lastImport?.createdAt,
      suggestions: [
        'Which fields have the most missing values?',
        'When was the data last imported?',
        'How does data quality affect the analytics?',
      ],
    };
  }

  private async getImportHistory(
    user: RequestUser,
    args: { limit?: number },
  ): Promise<CopilotToolExecution> {
    const result = await this.imports.findAll(user, 1, args.limit ?? 5);
    return {
      data: {
        total: result.total,
        imports: result.items.map(compactImport),
      },
      deepLinks: [{ label: 'Open import history', href: '/imports' }],
      recordsAnalyzed: result.items.length,
      suggestions: [
        'What is the current data quality?',
        'How many records were imported in the last import?',
        'Are there any failed imports to investigate?',
      ],
    };
  }

  // ── shared helpers ─────────────────────────────────────────────────────────

  // Resolves an optional departmentName to a scope-aware overview. When the name is not in the actor's scope,…
  // returns the full overview plus an `unresolved` marker so the LLM can state the limitation truthfully.
  private async overviewFor(
    user: RequestUser,
    departmentName?: string,
  ): Promise<{ departmentId?: string; overview: AnalyticsOverview; unresolved?: string }> {
    const filters = await this.analytics.getFilters(user);
    const name = departmentName?.trim();
    const match = name ? findDepartment(filters, name) : undefined;
    const overview = await this.analytics.getOverview(user, {
      ...(match ? { departmentId: match.id } : {}),
    });
    return {
      departmentId: match?.id,
      overview,
      unresolved: name && !match ? name : undefined,
    };
  }
}

// ── pure helpers (unit-testable) ─────────────────────────────────────────────

/** Case-insensitive department lookup in a scope-aware option list. */
export function findDepartment(
  filters: FilterOptions,
  name: string,
): { id: string; name: string } | undefined {
  const needle = name.trim().toLowerCase();
  return filters.departments.find((d) => d.name.toLowerCase() === needle);
}

export function resolveDepartments(
  filters: FilterOptions,
  names: string[],
): Array<{ id: string; name: string }> {
  const seen = new Set<string>();
  const resolved: Array<{ id: string; name: string }> = [];
  for (const name of names) {
    const match = findDepartment(filters, name);
    if (match && !seen.has(match.id)) {
      seen.add(match.id);
      resolved.push(match);
    }
  }
  return resolved;
}

function trimSlices<T extends { name: string }>(slices: T[]): T[] {
  return slices.slice(0, MAX_SLICES);
}

function trimEngagement(engagement: EngagementData): EngagementData {
  return {
    jobSatisfaction: engagement.jobSatisfaction.slice(0, MAX_SLICES),
    environmentSatisfaction: engagement.environmentSatisfaction.slice(0, MAX_SLICES),
    relationshipSatisfaction: engagement.relationshipSatisfaction.slice(0, MAX_SLICES),
    workLifeBalance: engagement.workLifeBalance.slice(0, MAX_SLICES),
    averageJobSatisfaction: engagement.averageJobSatisfaction,
    averageWorkLifeBalance: engagement.averageWorkLifeBalance,
    overtimeRate: engagement.overtimeRate,
  };
}

function trimComposition(composition: CompositionData): CompositionData {
  return {
    department: composition.department.slice(0, MAX_SLICES),
    jobRole: composition.jobRole.slice(0, MAX_SLICES),
    gender: composition.gender.slice(0, MAX_SLICES),
    age: composition.age.slice(0, MAX_SLICES),
    education: composition.education.slice(0, MAX_SLICES),
    tenure: composition.tenure.slice(0, MAX_SLICES),
  };
}

/** Compact, safe employee projection — salary is never included here. */
function compactEmployee(e: EmployeeView) {
  return {
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    email: e.email,
    jobTitle: e.jobTitle,
    department: e.department?.name ?? null,
    status: e.status,
    attrition: e.attrition ?? false,
    overTime: e.overTime ?? null,
    jobSatisfaction: e.jobSatisfaction ?? null,
    workLifeBalance: e.workLifeBalance ?? null,
    performanceRating: e.performanceRating ?? null,
    tenureYears: e.hiredAt ? tenureYearsOf(e.hiredAt) : null,
    manager: e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : null,
  };
}

function tenureYearsOf(hiredAt: string): number {
  const ms = Date.now() - new Date(hiredAt).getTime();
  return Math.max(0, Math.round((ms / (365.25 * 24 * 3600 * 1000)) * 10) / 10);
}

function compactImport(h: ImportHistoryView) {
  return {
    id: h.id,
    fileName: h.fileName,
    status: h.status,
    totalRows: h.totalRows,
    successCount: h.successCount,
    failedCount: h.failedCount,
    duplicateCount: h.duplicateCount,
    durationMs: h.durationMs,
    importedBy: h.importedBy ? h.importedBy.name : null,
    createdAt: h.createdAt,
  };
}

/** Builds an `/employees` href from explorer filters (only truthy params). */
export function employeeHref(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return query ? `/employees?${query}` : '/employees';
}
