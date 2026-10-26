import { Injectable } from '@nestjs/common';
import type { Employee, Prisma } from '@prisma/client';
import type {
  DashboardFilters,
  Department,
  ImportStatus,
  OrgHierarchy,
  OrgHierarchyNode,
} from '@orgwise/types';
import { PrismaService } from '@app/database/prisma.service';
import { buildAnalyticsWhere } from '@app/common/utils/analytics.util';

/** Employee projection the analytics engine reads — nothing more. */
export type AnalyticsEmployeeRow = Pick<
  Employee,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'jobTitle'
  | 'gender'
  | 'status'
  | 'departmentId'
  | 'hiredAt'
  | 'dateOfBirth'
  | 'attrition'
  | 'monthlyIncome'
  | 'jobSatisfaction'
  | 'environmentSatisfaction'
  | 'relationshipSatisfaction'
  | 'workLifeBalance'
  | 'overTime'
  | 'performanceRating'
  | 'education'
  | 'educationField'
  | 'totalWorkingYears'
  | 'yearsAtCompany'
>;

/** Hiring-pipeline row projection the talent engine reads. */
export interface HiringRecordRow {
  id: string;
  requisitionId: string;
  jobTitle: string;
  departmentId: string;
  openedAt: Date;
  offerSentAt: Date | null;
  acceptedAt: Date | null;
  sourcingCost: number | null;
  recruitingCost: number | null;
  offerStatus: string | null;
  status: string;
}

/** Minimal last-import projection for the data-quality indicator. */
export interface LastImportRow {
  id: string;
  fileName: string;
  status: ImportStatus;
  totalRows: number;
  successCount: number;
  failedCount: number;
  createdAt: Date;
}
// Data access for the analytics engine. Keeps Prisma queries out of the service so calculation logic stays pure…
// and unit-testable; every query is scope-aware (the `scope` argument comes from RbacService).
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly rowSelect = {
    id: true,
    firstName: true,
    lastName: true,
    jobTitle: true,
    gender: true,
    status: true,
    departmentId: true,
    hiredAt: true,
    dateOfBirth: true,
    attrition: true,
    monthlyIncome: true,
    jobSatisfaction: true,
    environmentSatisfaction: true,
    relationshipSatisfaction: true,
    workLifeBalance: true,
    overTime: true,
    performanceRating: true,
    education: true,
    educationField: true,
    totalWorkingYears: true,
    yearsAtCompany: true,
  } as const satisfies Prisma.EmployeeSelect;

  /**
   * Scoped employee projection for one filter state, optionally narrowed to
   * specific departments. `departmentIds` must not be combined with a
   * `filters.departmentId` — it is an explicit widen/override (used by compare,
   * which always passes an empty filter set).
   */
  async getEmployeeRows(
    scope: string[] | null,
    filters: DashboardFilters,
    departmentIds?: string[],
  ): Promise<AnalyticsEmployeeRow[]> {
    return this.prisma.employee.findMany({
      where: {
        ...buildAnalyticsWhere(scope, filters),
        // Narrow the scan to the departments actually being compared — never
        // ship every scoped row to compute a 2-department comparison.
        ...(departmentIds && departmentIds.length > 0
          ? { departmentId: { in: departmentIds } }
          : {}),
      },
      select: this.rowSelect,
      orderBy: { hiredAt: 'asc' },
    });
  }

  /** Distinct job titles within scope — powers the filter bar without shipping every employee row. */
  async getJobTitles(scope: string[] | null): Promise<string[]> {
    const rows = await this.prisma.employee.findMany({
      where: buildAnalyticsWhere(scope, {}),
      select: { jobTitle: true },
      distinct: ['jobTitle'],
      orderBy: { jobTitle: 'asc' },
    });
    return rows.map((r) => r.jobTitle);
  }

  /**
   * Scoped hiring-pipeline rows. Managers only see requisitions for the
   * departments they manage; admins see the full pipeline.
   */
  async getHiringRecords(scope: string[] | null): Promise<HiringRecordRow[]> {
    return this.prisma.hiringRecord.findMany({
      where: scope ? { departmentId: { in: scope } } : {},
      select: {
        id: true,
        requisitionId: true,
        jobTitle: true,
        departmentId: true,
        openedAt: true,
        offerSentAt: true,
        acceptedAt: true,
        sourcingCost: true,
        recruitingCost: true,
        offerStatus: true,
        status: true,
      },
      orderBy: { openedAt: 'asc' },
    });
  }

  /** Scope-wide department options (id + name) for filter dropdowns. */
  async getDepartmentNames(
    scope: string[] | null,
  ): Promise<Array<Pick<Department, 'id' | 'name'>>> {
    return this.prisma.department.findMany({
      where: { deletedAt: null, ...(scope ? { id: { in: scope } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Org-structure counts (within scope). */
  async getOrgCounts(scope: string[] | null): Promise<{
    departments: number;
    managers: number;
    teams: number;
  }> {
    const deptWhere: Prisma.DepartmentWhereInput = {
      deletedAt: null,
      ...(scope ? { id: { in: scope } } : {}),
    };
    const [departments, managerRows, teams] = await Promise.all([
      this.prisma.department.count({ where: deptWhere }),
      this.prisma.department.findMany({
        where: { ...deptWhere, managerUserId: { not: null } },
        select: { managerUserId: true },
        distinct: ['managerUserId'],
      }),
      this.prisma.team.count({
        where: { deletedAt: null, department: deptWhere },
      }),
    ]);
    return { departments, managers: managerRows.length, teams };
  }

  /** Soft-deleted records within scope (data-quality indicator). */
  async countDeleted(scope: string[] | null): Promise<number> {
    return this.prisma.employee.count({
      where: {
        deletedAt: { not: null },
        ...(scope ? { departmentId: { in: scope } } : {}),
      },
    });
  }

  /** Latest visible import (admin: org-wide; non-admin: their own). */
  async getLastImport(isAdmin: boolean, actorSub: string): Promise<LastImportRow | null> {
    return this.prisma.importHistory.findFirst({
      where: isAdmin ? {} : { importedByUserId: actorSub },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        successCount: true,
        failedCount: true,
        createdAt: true,
      },
    });
  }
  // Organization hierarchy: departments → teams → employees. For scoped callers only their departments (with…
  // their teams/employees) are returned; departments whose parent is outside the scope become roots. An
  // optional `search` term filters the tree server-side (matching employees + department/team names, with
  // ancestor paths kept) so the client never receives or filters the full dataset.
  async getHierarchy(scope: string[] | null, search?: string): Promise<OrgHierarchy> {
    const term = search?.trim();
    const deptWhere: Prisma.DepartmentWhereInput = {
      deletedAt: null,
      ...(scope ? { id: { in: scope } } : {}),
    };
    const [departments, teams, employees] = await Promise.all([
      this.prisma.department.findMany({
        where: deptWhere,
        select: { id: true, name: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.team.findMany({
        where: { deletedAt: null, department: deptWhere },
        select: { id: true, name: true, departmentId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: {
          deletedAt: null,
          ...(scope ? { departmentId: { in: scope } } : {}),
          ...(term
            ? {
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' } },
                  { lastName: { contains: term, mode: 'insensitive' } },
                  { jobTitle: { contains: term, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          status: true,
          departmentId: true,
          teamId: true,
        },
        orderBy: { firstName: 'asc' },
      }),
    ]);

    const deptIds = new Set(departments.map((d) => d.id));
    const nodes = new Map<string, OrgHierarchyNode>();

    for (const d of departments) {
      nodes.set(d.id, { id: d.id, type: 'department', name: d.name, subtitle: null, children: [] });
    }
    const teamNodeId = (id: string) => `team:${id}`;
    for (const t of teams) {
      nodes.set(teamNodeId(t.id), {
        id: t.id,
        type: 'team',
        name: t.name,
        subtitle: null,
        children: [],
      });
      const parent = nodes.get(t.departmentId);
      if (parent) parent.children.push(nodes.get(teamNodeId(t.id))!);
    }
    for (const e of employees) {
      const employeeNode: OrgHierarchyNode = {
        id: e.id,
        type: 'employee',
        name: `${e.firstName} ${e.lastName}`,
        subtitle: e.jobTitle,
        children: [],
        employee: {
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          status: e.status,
          departmentId: e.departmentId,
        },
      };
      const parent = e.teamId ? nodes.get(teamNodeId(e.teamId)) : nodes.get(e.departmentId);
      if (parent) parent.children.push(employeeNode);
    }

    // Roots: departments with no parent, or whose parent is outside the set.
    const rootNodes = departments
      .filter((d) => !d.parentId || !deptIds.has(d.parentId))
      .map((d) => nodes.get(d.id)!);

    // While searching, prune nodes that neither match the term nor contain a
    // match (employees were already filtered by the query; department/team
    // nodes additionally match on their own name). Ancestor paths to matches
    // are kept so the tree stays navigable.
    if (term) {
      const needle = term.toLowerCase();
      const prune = (node: OrgHierarchyNode): OrgHierarchyNode | null => {
        if (node.type === 'employee') return node;
        const selfMatches = node.name.toLowerCase().includes(needle);
        const children: OrgHierarchyNode[] = [];
        for (const child of node.children) {
          const kept = prune(child);
          if (kept) children.push(kept);
        }
        return selfMatches || children.length > 0 ? { ...node, children } : null;
      };
      const pruned = rootNodes
        .map((node) => prune(node))
        .filter((node): node is OrgHierarchyNode => node !== null);
      return { nodes: pruned, totalEmployees: employees.length };
    }

    return { nodes: rootNodes, totalEmployees: employees.length };
  }
}
