import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Employee, Prisma } from '@prisma/client';
import type { EmployeeView, Paginated } from '@orgwise/types';
import { AuditService } from '@app/audit/audit.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { RbacService } from '@app/common/services/rbac.service';
import { buildGroupFilter } from '@app/common/utils/analytics.util';
import { PrismaService } from '@app/database/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/** Analytics-profile fields writable via create/update — spread into Prisma data. */
type AnalyticsProfileData = {
  attrition?: boolean;
  attritionDate?: Date;
  monthlyIncome?: number;
  jobSatisfaction?: number;
  environmentSatisfaction?: number;
  relationshipSatisfaction?: number;
  workLifeBalance?: number;
  overTime?: boolean;
  performanceRating?: number;
  education?: number;
  educationField?: string;
  jobLevel?: number;
  yearsAtCompany?: number;
  totalWorkingYears?: number;
};
// Employee management — the workforce core domain. RBAC: admins see everything and can write; managers can…
// write but only within their assigned departments; viewers read everything but never write. Listing is…
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: RequestUser, query: QueryEmployeesDto): Promise<Paginated<EmployeeView>> {
    const { page, pageSize, sortBy, sortOrder } = query;
    const where = await this.buildWhere(actor, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.employeeInclude,
      }),
      this.prisma.employee.count({ where }),
    ]);

    const incomeVisible = this.rbac.canWrite(actor);
    return {
      items: items.map((e) => this.toView(e, incomeVisible)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** Export all matching employees as a CSV string. RBAC + filters identical to findAll. */
  async exportCsv(
    actor: RequestUser,
    query: QueryEmployeesDto,
  ): Promise<{ csv: string; count: number }> {
    const where = await this.buildWhere(actor, query);
    const incomeVisible = this.rbac.canWrite(actor);

    const items = await this.prisma.employee.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: this.employeeInclude,
    });

    const CSV_HEADERS = [
      'employeeCode',
      'firstName',
      'lastName',
      'email',
      'phone',
      'jobTitle',
      'gender',
      'dateOfBirth',
      'hiredAt',
      'status',
      'department',
      'team',
      'manager',
      'attrition',
      'monthlyIncome',
      'jobSatisfaction',
      'environmentSatisfaction',
      'relationshipSatisfaction',
      'workLifeBalance',
      'overTime',
      'performanceRating',
      'education',
      'educationField',
      'jobLevel',
      'yearsAtCompany',
      'totalWorkingYears',
    ];

    const rows = items.map((e) => {
      const v = this.toView(e, incomeVisible);
      return [
        v.employeeCode,
        v.firstName,
        v.lastName,
        v.email,
        v.phone ?? '',
        v.jobTitle,
        v.gender,
        v.dateOfBirth ?? '',
        v.hiredAt,
        v.status,
        v.department?.name ?? '',
        v.team?.name ?? '',
        v.manager ? `${v.manager.firstName} ${v.manager.lastName}` : '',
        v.attrition ? 'Yes' : 'No',
        v.monthlyIncome ?? '',
        v.jobSatisfaction ?? '',
        v.environmentSatisfaction ?? '',
        v.relationshipSatisfaction ?? '',
        v.workLifeBalance ?? '',
        v.overTime ? 'Yes' : 'No',
        v.performanceRating ?? '',
        v.education ?? '',
        v.educationField ?? '',
        v.jobLevel ?? '',
        v.yearsAtCompany ?? '',
        v.totalWorkingYears ?? '',
      ];
    });

    const escape = (val: string | number | boolean) => {
      const s = String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv = [CSV_HEADERS.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');

    return { csv, count: items.length };
  }

  // Get one employee — INCLUDING soft-deleted records. Deliberately wider than the list/update paths: audit-log…
  // entries and restore workflows link here, and a soft-deleted employee must still be viewable (with its…
  async findOne(actor: RequestUser, id: string): Promise<EmployeeView> {
    const employee = await this.prisma.employee.findFirst({
      where: { id },
      include: this.employeeInclude,
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (actor && !this.rbac.isAdmin(actor)) {
      const scope = await this.rbac.departmentScope(actor);
      if (scope && !scope.includes(employee.departmentId)) {
        throw new NotFoundException('Employee not found');
      }
      // Viewers must not read soft-deleted records — only admins (restore anywhere) and managers (restore within…
      // their scope) may. A deleted record is indistinguishable from a nonexistent one for viewers.
      if (!this.rbac.canWrite(actor) && employee.deletedAt) {
        throw new NotFoundException('Employee not found');
      }
    }
    return this.toView(employee, this.rbac.canWrite(actor));
  }

  async create(actor: RequestUser, dto: CreateEmployeeDto, ip?: string): Promise<EmployeeView> {
    await this.rbac.assertCanWrite(actor, dto.departmentId);
    await this.validateReferences(actor, dto, dto.departmentId);
    await this.ensureUnique(dto.employeeCode, dto.email);

    const employee = await this.prisma.employee.create({
      data: {
        employeeCode: dto.employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? null,
        jobTitle: dto.jobTitle,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ?? null,
        hiredAt: dto.hiredAt,
        // Attrition is a lifecycle event — a flagged leaver is terminated.
        status: dto.attrition ? (dto.status ?? 'terminated') : (dto.status ?? 'active'),
        departmentId: dto.departmentId,
        teamId: dto.teamId ?? null,
        managerId: dto.managerId ?? null,
        ...this.profileFromDto(dto),
      },
      include: this.employeeInclude,
    });

    await this.audit.record(
      actor.sub,
      'create',
      'employee',
      employee.id,
      { email: employee.email } as Prisma.InputJsonValue,
      ip,
    );
    return this.toView(employee, this.rbac.canWrite(actor));
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateEmployeeDto,
    ip?: string,
  ): Promise<EmployeeView> {
    const existing = await this.requireEmployee(id);
    const departmentId = dto.departmentId ?? existing.departmentId;
    await this.rbac.assertCanWrite(actor, departmentId);

    if (dto.employeeCode && dto.employeeCode !== existing.employeeCode) {
      await this.ensureUnique(dto.employeeCode, undefined, id);
    }
    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      await this.ensureUnique(undefined, dto.email, id);
    }
    await this.validateReferences(actor, dto, departmentId, existing.teamId);
    if (dto.managerId === id) {
      throw new BadRequestException('An employee cannot be their own manager');
    }

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.employeeCode !== undefined && { employeeCode: dto.employeeCode }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email.toLowerCase() }),
        ...(dto.phone !== undefined && { phone: dto.phone ?? null }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ?? null }),
        ...(dto.hiredAt !== undefined && { hiredAt: dto.hiredAt }),
        ...(dto.status !== undefined && { status: dto.status }),
        // Flagging attrition without an explicit status is a lifecycle event:
        // terminate the employee (an already-terminated record is unaffected).
        ...(dto.attrition === true && dto.status === undefined
          ? { status: 'terminated' as const }
          : {}),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.teamId !== undefined && { teamId: dto.teamId ?? null }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId ?? null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...this.profileFromDto(dto, existing.attritionDate),
      },
      include: this.employeeInclude,
    });

    await this.audit.record(
      actor.sub,
      'update',
      'employee',
      id,
      { changes: dto } as unknown as Prisma.InputJsonValue,
      ip,
    );
    return this.toView(employee, this.rbac.canWrite(actor));
  }

  /** Soft-delete an employee — the record stays in history/audit/dashboard data. */
  async remove(
    actor: RequestUser,
    id: string,
    ip?: string,
  ): Promise<{ id: string; deleted: true }> {
    const existing = await this.requireEmployee(id);
    await this.rbac.assertCanWrite(actor, existing.departmentId);

    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record(
      actor.sub,
      'delete',
      'employee',
      id,
      { email: existing.email } as Prisma.InputJsonValue,
      ip,
    );
    return { id, deleted: true };
  }
  // Restore a soft-deleted employee — reverses `remove()` and brings the record back into active view with its…
  // org placement intact. Only a record that is actually deleted can be restored (404 otherwise). Uniqueness is…
  async restore(actor: RequestUser, id: string, ip?: string): Promise<EmployeeView> {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: { not: null } },
      include: this.employeeInclude,
    });
    if (!employee) throw new NotFoundException('Employee not found or not deleted');
    await this.rbac.assertCanWrite(actor, employee.departmentId);

    try {
      await this.ensureUnique(employee.employeeCode, employee.email, id);
    } catch (error) {
      // ensureUnique's generic "already exists" message reads oddly on a
      // restore — rethrow with a restore-specific explanation.
      if (error instanceof ConflictException) {
        throw new ConflictException(
          'Cannot restore: an active employee already uses this email or employee code',
        );
      }
      throw error;
    }

    const restored = await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
      include: this.employeeInclude,
    });

    await this.audit.record(
      actor.sub,
      'restore',
      'employee',
      id,
      {
        email: employee.email,
        deletedAt: employee.deletedAt?.toISOString(),
      } as Prisma.InputJsonValue,
      ip,
    );
    return this.toView(restored, this.rbac.canWrite(actor));
  }

  /** Bulk action on multiple employees at once. RBAC-checked per-department. */
  async bulkAction(
    actor: RequestUser,
    dto: {
      employeeIds: string[];
      action: string;
      status?: string;
      departmentId?: string;
      managerId?: string;
    },
    ip?: string,
  ): Promise<{ succeeded: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    const { employeeIds, action } = dto;
    if (!this.rbac.canWrite(actor)) {
      throw new ForbiddenException('Insufficient permissions for bulk actions');
    }

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        departmentId: true,
        firstName: true,
        lastName: true,
        email: true,
        deletedAt: true,
      },
    });

    const foundMap = new Map(employees.map((e) => [e.id, e]));
    let succeeded = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of employeeIds) {
      const emp = foundMap.get(id);
      if (!emp) {
        errors.push({ id, error: 'Employee not found' });
        continue;
      }
      try {
        await this.rbac.assertCanWrite(actor, emp.departmentId);
        let data: Record<string, unknown> = {};

        if (action === 'update_status') {
          if (!dto.status) {
            errors.push({ id, error: 'Status is required' });
            continue;
          }
          data = { status: dto.status };
        } else if (action === 'update_department') {
          if (!dto.departmentId) {
            errors.push({ id, error: 'Department is required' });
            continue;
          }
          const dept = await this.prisma.department.findFirst({
            where: { id: dto.departmentId, deletedAt: null },
          });
          if (!dept) {
            errors.push({ id, error: 'Department not found' });
            continue;
          }
          data = { departmentId: dto.departmentId };
        } else if (action === 'update_manager') {
          const managerId = dto.managerId === '' ? null : dto.managerId;
          if (managerId) {
            const mgr = await this.prisma.employee.findFirst({
              where: { id: managerId, deletedAt: null },
            });
            if (!mgr) {
              errors.push({ id, error: 'Manager not found' });
              continue;
            }
          }
          data = { managerId };
        } else if (action === 'delete') {
          data = { deletedAt: new Date(), isActive: false };
        }

        await this.prisma.employee.update({
          where: { id },
          data: data as Prisma.EmployeeUncheckedUpdateInput,
        });
        await this.audit.record(
          actor.sub,
          action === 'delete' ? 'delete' : 'update',
          'employee',
          id,
          { action, ...(dto as object) } as Prisma.InputJsonValue,
          ip,
        );
        succeeded++;
      } catch (error) {
        errors.push({ id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { succeeded, failed: errors.length, errors };
  }

  // ── private helpers ────────────────────────────────────────────────────────

  /** Build the RBAC-aware Prisma where clause. Shared by findAll and exportCsv. */
  private async buildWhere(
    actor: RequestUser,
    query: QueryEmployeesDto,
  ): Promise<Prisma.EmployeeWhereInput> {
    const {
      search,
      departmentId,
      teamId,
      status,
      gender,
      includeDeleted,
      jobTitle,
      overTime,
      attrition,
      jobSatisfaction,
      education,
      ageGroup,
      tenureGroup,
    } = query;
    const scope = await this.rbac.departmentScope(actor);
    const canIncludeDeleted = this.rbac.canWrite(actor) && includeDeleted;
    const departmentFilter: string | { in: string[] } | undefined = scope
      ? departmentId
        ? scope.includes(departmentId)
          ? departmentId
          : { in: [] }
        : { in: scope }
      : departmentId;

    return {
      ...(canIncludeDeleted ? {} : { deletedAt: null }),
      ...(departmentFilter ? { departmentId: departmentFilter } : {}),
      ...(teamId ? { teamId } : {}),
      ...(status ? { status } : {}),
      ...(gender ? { gender } : {}),
      ...(search ? this.buildSearch(search) : {}),
      ...(jobTitle ? { jobTitle: { equals: jobTitle, mode: 'insensitive' } } : {}),
      ...(overTime !== undefined ? { overTime } : {}),
      ...(attrition !== undefined ? { attrition } : {}),
      ...(jobSatisfaction ? { jobSatisfaction } : {}),
      ...(education ? { education } : {}),
      ...(ageGroup ? buildGroupFilter('age', ageGroup) : {}),
      ...(tenureGroup ? buildGroupFilter('tenure', tenureGroup) : {}),
    };
  }

  private buildSearch(search: string): Prisma.EmployeeWhereInput {
    const term = search.trim();
    if (!term) return {};
    return {
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { employeeCode: { contains: term, mode: 'insensitive' } },
        { jobTitle: { contains: term, mode: 'insensitive' } },
      ],
    };
  }
  // Maps the optional analytics-profile DTO fields into the update/create payload. Status lifecycle handling…
  // (attrition → terminated) lives at the call sites so this helper only ever touches analytics fields — the…
  private profileFromDto(
    dto: CreateEmployeeDto | UpdateEmployeeDto,
    existingAttritionDate?: Date | null,
  ): AnalyticsProfileData {
    const data: AnalyticsProfileData = {};
    if (dto.attrition !== undefined) {
      data.attrition = dto.attrition;
      // Stamp the event date once — never overwrite an existing attrition date.
      if (dto.attrition && dto.attritionDate === undefined && !existingAttritionDate) {
        data.attritionDate = new Date();
      }
    }
    if (dto.attritionDate !== undefined) data.attritionDate = dto.attritionDate;
    if (dto.monthlyIncome !== undefined) data.monthlyIncome = dto.monthlyIncome;
    if (dto.jobSatisfaction !== undefined) data.jobSatisfaction = dto.jobSatisfaction;
    if (dto.environmentSatisfaction !== undefined) {
      data.environmentSatisfaction = dto.environmentSatisfaction;
    }
    if (dto.relationshipSatisfaction !== undefined) {
      data.relationshipSatisfaction = dto.relationshipSatisfaction;
    }
    if (dto.workLifeBalance !== undefined) data.workLifeBalance = dto.workLifeBalance;
    if (dto.overTime !== undefined) data.overTime = dto.overTime;
    if (dto.performanceRating !== undefined) data.performanceRating = dto.performanceRating;
    if (dto.education !== undefined) data.education = dto.education;
    if (dto.educationField !== undefined) data.educationField = dto.educationField;
    if (dto.jobLevel !== undefined) data.jobLevel = dto.jobLevel;
    if (dto.yearsAtCompany !== undefined) data.yearsAtCompany = dto.yearsAtCompany;
    if (dto.totalWorkingYears !== undefined) data.totalWorkingYears = dto.totalWorkingYears;
    return data;
  }

  private async requireEmployee(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: this.employeeInclude,
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }
  // Uniqueness check for employee code / email. NOTE: soft-deleted rows are deliberately included. The database…
  // unique indexes are global (not partial), so a deleted employee still occupies its email/code. Excluding them…
  private async ensureUnique(
    employeeCode?: string,
    email?: string,
    excludeId?: string,
  ): Promise<void> {
    const where: Prisma.EmployeeWhereInput = {
      NOT: excludeId ? { id: excludeId } : undefined,
    };
    const conflicts = await this.prisma.employee.findMany({
      where: {
        OR: [
          ...(employeeCode ? [{ employeeCode }] : []),
          ...(email ? [{ email: email.toLowerCase() }] : []),
        ],
        ...where,
      },
      select: { employeeCode: true, email: true },
    });
    const c = conflicts[0];
    if (c) {
      if (c.employeeCode === employeeCode) {
        throw new ConflictException(`Employee code "${employeeCode}" already exists`);
      }
      if (c.email === email?.toLowerCase()) {
        throw new ConflictException(`An employee with email "${email}" already exists`);
      }
      throw new ConflictException('Employee code or email already exists');
    }
  }

  private async validateReferences(
    actor: RequestUser,
    dto: CreateEmployeeDto | UpdateEmployeeDto,
    departmentId: string,
    existingTeamId?: string | null,
  ): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, deletedAt: null },
    });
    if (!department) throw new BadRequestException('Department not found');
    // Enforce team↔department consistency ONLY when this update actually changes the department or the team: if the…
    // department moves, an unchanged team must belong to the new department; if the team changes, it must belong to…
    const teamId = dto.teamId ?? (dto.departmentId !== undefined ? existingTeamId : undefined);
    if (teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: teamId, departmentId, deletedAt: null },
      });
      if (!team) throw new BadRequestException('Team not found in the given department');
    }
    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: dto.managerId, deletedAt: null },
      });
      if (!manager) throw new BadRequestException('Manager employee not found');
      // Horizontal-scope guard: a manager may only reference a manager employee inside their own departments. Without…
      // this, a manager could probe for employees in other departments by id through the manager field (an IDOR-style…
      if (this.rbac.isManager(actor)) {
        const scope = await this.rbac.departmentScope(actor);
        if (scope && !scope.includes(manager.departmentId)) {
          throw new BadRequestException(
            'The assigned manager is outside your assigned departments',
          );
        }
      }
    }
  }

  private readonly employeeInclude = {
    department: { select: { id: true, name: true } },
    team: { select: { id: true, name: true } },
    manager: { select: { id: true, firstName: true, lastName: true, email: true } },
  } as const;
  // Maps an employee row to the wire view. `incomeVisible` (admin/manager only) gates salary data — viewers never…
  // receive `monthlyIncome`, and the field is serialized as null so the client cannot distinguish "no data" from…
  private toView(
    e: Employee & {
      department?: { id: string; name: string } | null;
      team?: { id: string; name: string } | null;
      manager?: { id: string; firstName: string; lastName: string; email: string } | null;
    },
    incomeVisible: boolean,
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
      deletedAt: e.deletedAt?.toISOString() ?? null,
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
      // Analytics & engagement profile.
      attrition: e.attrition,
      attritionDate: e.attritionDate?.toISOString() ?? null,
      monthlyIncome: incomeVisible ? (e.monthlyIncome ?? null) : null,
      jobSatisfaction: e.jobSatisfaction ?? null,
      environmentSatisfaction: e.environmentSatisfaction ?? null,
      relationshipSatisfaction: e.relationshipSatisfaction ?? null,
      workLifeBalance: e.workLifeBalance ?? null,
      overTime: e.overTime ?? null,
      performanceRating: e.performanceRating ?? null,
      education: e.education ?? null,
      educationField: e.educationField ?? null,
      jobLevel: e.jobLevel ?? null,
      yearsAtCompany: e.yearsAtCompany ?? null,
      totalWorkingYears: e.totalWorkingYears ?? null,
    };
  }
}
