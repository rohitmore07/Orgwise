import { Injectable } from '@nestjs/common';
import type {
  DashboardFilters,
  DashboardOverview,
  DistributionSlice,
  EmployeeView,
} from '@orgwise/types';
import type { Employee, Prisma } from '@prisma/client';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { RbacService } from '@app/common/services/rbac.service';
import { PrismaService } from '@app/database/prisma.service';
// Initial analytics dashboard. Aggregates headcount KPIs and distribution slices (department, status, gender)…
// plus recent hires. Optional {@link DashboardFilters} slice the whole overview server-side; managers always…
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async getOverview(
    actor: RequestUser,
    filters: DashboardFilters = {},
  ): Promise<DashboardOverview> {
    const scope = await this.rbac.departmentScope(actor);
    // The manager scope is AUTHORITATIVE — an explicit department filter may only narrow it, never widen it.…
    // Intersect: an in-scope id narrows to that department; an out-of-scope id matches nothing (empty IN), so a…
    const departmentFilter: string | { in: string[] } | undefined = scope
      ? filters.departmentId
        ? scope.includes(filters.departmentId)
          ? filters.departmentId
          : { in: [] }
        : { in: scope }
      : filters.departmentId;

    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      ...(departmentFilter ? { departmentId: departmentFilter } : {}),
      // A team belongs to exactly one department, so combining the scope
      // constraint with a teamId filter can never escape the manager's scope.
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.gender ? { gender: filters.gender } : {}),
    };
    // Org KPIs follow the same intersected department filter so a filtered
    // view stays coherent; the filter-option list stays scope-wide below.
    const orgWhere: Prisma.DepartmentWhereInput = {
      deletedAt: null,
      ...(departmentFilter ? { id: departmentFilter } : {}),
    };

    const [totalEmployees, activeEmployees, totalDepartments, totalManagers, totalTeams] =
      await Promise.all([
        this.prisma.employee.count({ where }),
        this.prisma.employee.count({ where: { ...where, status: 'active' } }),
        this.prisma.department.count({ where: orgWhere }),
        this.countDepartmentManagers(orgWhere),
        this.prisma.team.count({
          where: { deletedAt: null, department: scope ? { id: { in: scope } } : {} },
        }),
      ]);
    // Scope-aware department options (id + name) so the client's filter dropdown can never offer a department the…
    // caller cannot see. Kept scope-wide (not narrowed by the active filter) so the dropdown stays usable while a…
    const optionsWhere: Prisma.DepartmentWhereInput = {
      deletedAt: null,
      ...(scope ? { id: { in: scope } } : {}),
    };

    const [departments, departmentDistribution, employeeStatus, genderDistribution, recentHires] =
      await Promise.all([
        this.prisma.department.findMany({
          where: optionsWhere,
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        this.groupEmployees(this.prisma, where, 'departmentId'),
        this.groupEmployees(this.prisma, where, 'status'),
        this.groupEmployees(this.prisma, where, 'gender'),
        this.prisma.employee.findMany({
          where,
          orderBy: { hiredAt: 'desc' },
          take: 6,
          include: {
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
            manager: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
      ]);

    const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));

    return {
      kpis: {
        totalEmployees,
        activeEmployees,
        totalDepartments,
        totalManagers,
        totalTeams,
      },
      departments: departments.map((d) => ({ id: d.id, name: d.name })),
      departmentDistribution: departmentDistribution.map((slice) => ({
        ...slice,
        name: departmentNameById.get(slice.name) ?? 'Unassigned',
      })),
      employeeStatus,
      genderDistribution,
      recentHires: recentHires.map((e) => this.toEmployeeView(e)),
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  // Distinct department managers WITHIN scope. Counting manager *accounts* globally would leak org size to scoped…
  // managers and disagree with the department-scoped numbers around it.
  private async countDepartmentManagers(orgWhere: Prisma.DepartmentWhereInput): Promise<number> {
    const rows = await this.prisma.department.findMany({
      where: { ...orgWhere, managerUserId: { not: null } },
      select: { managerUserId: true },
      distinct: ['managerUserId'],
    });
    return rows.length;
  }

  private async groupEmployees(
    prisma: PrismaService,
    where: Prisma.EmployeeWhereInput,
    field: 'departmentId' | 'status' | 'gender',
  ): Promise<DistributionSlice[]> {
    const rows = await prisma.employee.groupBy({ by: [field], where, _count: { _all: true } });
    return rows
      .map((row) => ({
        name: this.humanize(field, row[field] as string | null),
        value: row._count._all,
      }))
      .sort((a, b) => b.value - a.value);
  }

  private humanize(field: 'departmentId' | 'status' | 'gender', value: string | null): string {
    if (field === 'departmentId') return value ?? 'Unassigned';
    return value
      ? value
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : 'Unknown';
  }

  private toEmployeeView(
    e: Employee & {
      department?: { id: string; name: string } | null;
      team?: { id: string; name: string } | null;
      manager?: { id: string; firstName: string; lastName: string; email: string } | null;
    },
  ): EmployeeView {
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone,
      jobTitle: e.jobTitle,
      gender: e.gender,
      dateOfBirth: e.dateOfBirth?.toISOString() ?? null,
      hiredAt: e.hiredAt.toISOString(),
      status: e.status,
      isActive: e.isActive,
      departmentId: e.departmentId,
      teamId: e.teamId,
      managerId: e.managerId,
      userId: e.userId,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      department: e.department ? { id: e.department.id, name: e.department.name } : null,
      team: e.team ? { id: e.team.id, name: e.team.name } : null,
      manager: e.manager
        ? {
            id: e.manager.id,
            firstName: e.manager.firstName,
            lastName: e.manager.lastName,
            email: e.manager.email,
          }
        : null,
    };
  }
}
