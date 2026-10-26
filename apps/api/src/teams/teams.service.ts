import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Team } from '@prisma/client';
import type { TeamSummary } from '@orgwise/types';
import { AuditService } from '@app/audit/audit.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { RbacService } from '@app/common/services/rbac.service';
import { PrismaService } from '@app/database/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
// Team management — sub-units within departments. Admin-managed; managers and viewers read. Team leads are…
// employees, not accounts.
@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: RequestUser, departmentId?: string): Promise<TeamSummary[]> {
    const scope = await this.rbac.departmentScope(actor);
    // The manager scope is AUTHORITATIVE — an explicit department filter may only narrow it, never widen it…
    // (mirrors the dashboard/employee rules). An out-of-scope department id matches nothing rather than leaking…
    const departmentFilter: string | { in: string[] } | undefined = scope
      ? departmentId
        ? scope.includes(departmentId)
          ? departmentId
          : { in: [] }
        : { in: scope }
      : departmentId;

    const teams = await this.prisma.team.findMany({
      where: {
        deletedAt: null,
        ...(departmentFilter ? { departmentId: departmentFilter } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true } },
        leadEmployee: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { employees: { where: { deletedAt: null } } } },
      },
    });
    return teams.map((t) => this.toSummary(t));
  }

  async findOne(actor: RequestUser, id: string): Promise<TeamSummary> {
    const team = await this.prisma.team.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: { select: { id: true, name: true } },
        leadEmployee: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { employees: { where: { deletedAt: null } } } },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    // Resource-level check: a manager may only read teams inside their assigned departments. NotFound (not…
    // Forbidden) keeps out-of-scope ids indistinguishable from nonexistent ones.
    if (!this.rbac.isAdmin(actor)) {
      const scope = await this.rbac.departmentScope(actor);
      if (scope && !scope.includes(team.departmentId)) {
        throw new NotFoundException('Team not found');
      }
    }
    return this.toSummary(team);
  }

  async create(actor: RequestUser, dto: CreateTeamDto, ip?: string): Promise<TeamSummary> {
    this.rbac.assertCanManageOrg(actor);
    await this.validateReferences(dto.departmentId, dto.leadEmployeeId);
    await this.ensureUniqueName(dto.name, dto.departmentId);

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        departmentId: dto.departmentId,
        leadEmployeeId: dto.leadEmployeeId ?? null,
      },
      include: this.summaryInclude,
    });
    await this.audit.record(
      actor.sub,
      'create',
      'team',
      team.id,
      { name: team.name } as Prisma.InputJsonValue,
      ip,
    );
    return this.toSummary(team);
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateTeamDto,
    ip?: string,
  ): Promise<TeamSummary> {
    this.rbac.assertCanManageOrg(actor);
    const existing = await this.requireTeam(id);
    const nextDepartmentId = dto.departmentId ?? existing.departmentId;

    if (dto.name) {
      await this.ensureUniqueName(dto.name, nextDepartmentId, id);
    } else if (dto.departmentId && dto.departmentId !== existing.departmentId) {
      // Moving to a new department without renaming — the name must be free there.
      await this.ensureUniqueName(existing.name, nextDepartmentId, id);
    }
    await this.validateReferences(nextDepartmentId, dto.leadEmployeeId);

    const team = await this.prisma.team.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description ?? null }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.leadEmployeeId !== undefined && { leadEmployeeId: dto.leadEmployeeId ?? null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: this.summaryInclude,
    });
    await this.audit.record(
      actor.sub,
      'update',
      'team',
      id,
      { changes: dto } as unknown as Prisma.InputJsonValue,
      ip,
    );
    return this.toSummary(team);
  }

  async remove(
    actor: RequestUser,
    id: string,
    ip?: string,
  ): Promise<{ id: string; deleted: true }> {
    this.rbac.assertCanManageOrg(actor);
    await this.requireTeam(id);

    const employeeCount = await this.prisma.employee.count({
      where: { teamId: id, deletedAt: null },
    });
    if (employeeCount > 0) {
      throw new ConflictException('Cannot delete a team that still has employees');
    }

    await this.prisma.team.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(actor.sub, 'delete', 'team', id, undefined, ip);
    return { id, deleted: true };
  }

  private async requireTeam(id: string): Promise<Team> {
    const team = await this.prisma.team.findFirst({ where: { id, deletedAt: null } });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  private async ensureUniqueName(
    name: string,
    departmentId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.team.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        departmentId,
        deletedAt: null,
        NOT: excludeId ? { id: excludeId } : undefined,
      },
    });
    if (existing)
      throw new ConflictException(`A team named "${name}" already exists in this department`);
  }

  private async validateReferences(departmentId?: string, leadEmployeeId?: string): Promise<void> {
    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, deletedAt: null },
      });
      if (!department) throw new BadRequestException('Department not found');
    }
    if (leadEmployeeId) {
      const lead = await this.prisma.employee.findFirst({
        where: { id: leadEmployeeId, deletedAt: null },
      });
      if (!lead) throw new BadRequestException('Lead employee not found');
    }
  }

  private readonly summaryInclude = {
    department: { select: { id: true, name: true } },
    leadEmployee: { select: { id: true, firstName: true, lastName: true } },
    _count: { select: { employees: { where: { deletedAt: null } } } },
  } as const;

  private toSummary(
    t: Team & {
      department?: { id: string; name: string } | null;
      leadEmployee?: { id: string; firstName: string; lastName: string } | null;
      _count?: { employees: number };
    },
  ): TeamSummary {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      isActive: t.isActive,
      departmentId: t.departmentId,
      leadEmployeeId: t.leadEmployeeId,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      department: t.department ? { id: t.department.id, name: t.department.name } : null,
      leadEmployee: t.leadEmployee
        ? {
            id: t.leadEmployee.id,
            firstName: t.leadEmployee.firstName,
            lastName: t.leadEmployee.lastName,
          }
        : null,
      employeeCount: t._count?.employees ?? 0,
    };
  }
}
