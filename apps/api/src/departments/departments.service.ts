import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Department, Prisma } from '@prisma/client';
import type { DepartmentSummary, User } from '@orgwise/types';
import { AuditService } from '@app/audit/audit.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { RbacService } from '@app/common/services/rbac.service';
import { PrismaService } from '@app/database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
// Department management — org hierarchy, manager assignment, soft delete. Only admins may mutate organization…
// structure; managers and viewers read.
@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: RequestUser): Promise<DepartmentSummary[]> {
    // Scope: managers only see the departments they manage. Viewers keep read-only access to the full org…
    // (documented product rule), so the scope filter applies to managers only — the same model as employees.
    const scope = await this.rbac.departmentScope(actor);
    const departments = await this.prisma.department.findMany({
      where: { deletedAt: null, ...(scope ? { id: { in: scope } } : {}) },
      orderBy: { name: 'asc' },
      include: {
        managerUser: { select: { id: true, name: true, email: true, role: true } },
        parent: { select: { id: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            employees: { where: { deletedAt: null } },
            teams: { where: { deletedAt: null } },
          },
        },
      },
    });

    return departments.map((d) => this.toSummary(d));
  }

  async findOne(actor: RequestUser, id: string): Promise<DepartmentSummary> {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        managerUser: { select: { id: true, name: true, email: true, role: true } },
        parent: { select: { id: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            employees: { where: { deletedAt: null } },
            teams: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!department) throw new NotFoundException('Department not found');
    // Resource-level check: a manager may only read departments they manage.
    if (!this.rbac.isAdmin(actor)) {
      const scope = await this.rbac.departmentScope(actor);
      if (scope && !scope.includes(department.id)) {
        throw new NotFoundException('Department not found');
      }
    }
    return this.toSummary(department);
  }

  async create(
    actor: RequestUser,
    dto: CreateDepartmentDto,
    ip?: string,
  ): Promise<DepartmentSummary> {
    this.rbac.assertCanManageOrg(actor);
    await this.validateReferences(dto.parentId, dto.managerUserId);
    await this.ensureUniqueName(dto.name);

    const department = await this.prisma.department.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        parentId: dto.parentId ?? null,
        managerUserId: dto.managerUserId ?? null,
      },
      include: this.summaryInclude,
    });

    await this.audit.record(
      actor.sub,
      'create',
      'department',
      department.id,
      { name: department.name } as Prisma.InputJsonValue,
      ip,
    );
    return this.toSummary(department);
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateDepartmentDto,
    ip?: string,
  ): Promise<DepartmentSummary> {
    this.rbac.assertCanManageOrg(actor);
    const existing = await this.requireDepartment(id);

    if (dto.name && dto.name !== existing.name) {
      await this.ensureUniqueName(dto.name, id);
    }
    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('A department cannot be its own parent');
    }
    if (dto.parentId && (await this.wouldCreateCycle(id, dto.parentId))) {
      throw new BadRequestException('This assignment would create a circular department hierarchy');
    }
    await this.validateReferences(dto.parentId, dto.managerUserId);

    const department = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description ?? null }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId ?? null }),
        ...(dto.managerUserId !== undefined && { managerUserId: dto.managerUserId ?? null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: this.summaryInclude,
    });

    await this.audit.record(
      actor.sub,
      'update',
      'department',
      id,
      { changes: dto } as unknown as Prisma.InputJsonValue,
      ip,
    );
    return this.toSummary(department);
  }

  /** Soft-delete a department (keeps history + audit intact). */
  async remove(
    actor: RequestUser,
    id: string,
    ip?: string,
  ): Promise<{ id: string; deleted: true }> {
    this.rbac.assertCanManageOrg(actor);
    await this.requireDepartment(id);

    const employeeCount = await this.prisma.employee.count({
      where: { departmentId: id, deletedAt: null },
    });
    if (employeeCount > 0) {
      throw new ConflictException('Cannot delete a department that still has employees');
    }
    // Children keep `parentId` pointing at this row — soft-deleting a parent
    // would orphan the whole subtree, so require it to be a leaf.
    const childCount = await this.prisma.department.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ConflictException('Cannot delete a department that has child departments');
    }

    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(actor.sub, 'delete', 'department', id, undefined, ip);
    return { id, deleted: true };
  }

  private async requireDepartment(id: string): Promise<Department> {
    const department = await this.prisma.department.findFirst({ where: { id, deletedAt: null } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private async ensureUniqueName(name: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.department.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
        NOT: excludeId ? { id: excludeId } : undefined,
      },
    });
    if (existing) throw new ConflictException(`A department named "${name}" already exists`);
  }

  private async validateReferences(parentId?: string, managerUserId?: string): Promise<void> {
    if (parentId) {
      const parent = await this.prisma.department.findFirst({
        where: { id: parentId, deletedAt: null },
      });
      if (!parent) throw new BadRequestException('Parent department not found');
    }
    if (managerUserId) {
      const manager = await this.prisma.user.findUnique({ where: { id: managerUserId } });
      if (!manager) throw new BadRequestException('Assigned manager user not found');
      // A department manager must actually hold a management role — assigning a viewer would create a dead assignment…
      // (their scope only kicks in for the Manager role) and mislead the org chart.
      if (manager.role !== 'manager' && manager.role !== 'admin') {
        throw new BadRequestException('Department managers must hold the Manager or Admin role');
      }
    }
  }
  // True when setting `parentId` on `id` would close a cycle (the new parent is `id` itself or one of its…
  // descendants). Walks the ancestor chain of the proposed parent — a department that is its own ancestor can…
  private async wouldCreateCycle(id: string, parentId: string): Promise<boolean> {
    let current: string | null = parentId;
    const visited = new Set<string>();
    while (current) {
      if (current === id) return true;
      if (visited.has(current)) return false; // pre-existing cycle elsewhere — not ours to fix
      visited.add(current);
      const parent: { parentId: string | null } | null = await this.prisma.department.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      if (!parent) return false;
      current = parent.parentId;
    }
    return false;
  }

  private readonly summaryInclude = {
    managerUser: { select: { id: true, name: true, email: true, role: true } },
    parent: { select: { id: true, name: true } },
    children: {
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    },
    _count: {
      select: { employees: { where: { deletedAt: null } }, teams: { where: { deletedAt: null } } },
    },
  } as const;

  private toSummary(
    d: Department & {
      managerUser?: { id: string; name: string; email: string; role: string } | null;
      parent?: { id: string; name: string } | null;
      children?: Array<{ id: string; name: string }>;
      _count?: { employees: number; teams: number };
    },
  ): DepartmentSummary {
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      isActive: d.isActive,
      parentId: d.parentId,
      managerUserId: d.managerUserId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      manager: d.managerUser
        ? {
            id: d.managerUser.id,
            email: d.managerUser.email,
            name: d.managerUser.name,
            role: d.managerUser.role as User['role'],
          }
        : null,
      parent: d.parent ? { id: d.parent.id, name: d.parent.name } : null,
      children: d.children ?? [],
      teamCount: d._count?.teams ?? 0,
      employeeCount: d._count?.employees ?? 0,
    };
  }
}
