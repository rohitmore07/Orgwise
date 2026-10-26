import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Department } from '@prisma/client';
import type { AuditService } from '@app/audit/audit.service';
import type { RbacService } from '@app/common/services/rbac.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { Role } from '@app/common/enums/role.enum';
import type { PrismaService } from '@app/database/prisma.service';
import { DepartmentsService } from './departments.service';

const actor = (role: Role): RequestUser => ({
  sub: 'user-1',
  email: 'user@orgwise.com',
  roles: [role],
});

function departmentRow(overrides: Partial<Department> = {}): Department {
  return {
    id: 'dept-1',
    name: 'Engineering',
    description: null,
    isActive: true,
    parentId: null,
    managerUserId: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Department;
}

function createMocks() {
  const prisma = {
    department: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employee: { count: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const rbac = {
    departmentScope: jest.fn().mockResolvedValue(null),
    isAdmin: jest.fn().mockReturnValue(true),
    assertCanManageOrg: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { prisma, rbac, audit };
}

describe('DepartmentsService', () => {
  let mocks: ReturnType<typeof createMocks>;
  let service: DepartmentsService;

  beforeEach(() => {
    mocks = createMocks();
    service = new DepartmentsService(
      mocks.prisma as unknown as PrismaService,
      mocks.rbac as unknown as RbacService,
      mocks.audit as unknown as AuditService,
    );
  });

  describe('findAll — scope', () => {
    it('admins and viewers see every department (no scope filter)', async () => {
      mocks.prisma.department.findMany.mockResolvedValue([departmentRow()]);

      await service.findAll(actor(Role.ADMIN));
      expect(mocks.prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );

      await service.findAll(actor(Role.VIEWER));
      expect(mocks.prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('managers only see their assigned departments', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-1', 'dept-2']);
      mocks.prisma.department.findMany.mockResolvedValue([departmentRow()]);

      await service.findAll(actor(Role.MANAGER));

      expect(mocks.prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, id: { in: ['dept-1', 'dept-2'] } } }),
      );
    });

    it('a manager with an EMPTY scope sees zero departments (never all)', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue([]);
      mocks.prisma.department.findMany.mockResolvedValue([]);

      const result = await service.findAll(actor(Role.MANAGER));

      expect(result).toEqual([]);
      expect(mocks.prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, id: { in: [] } } }),
      );
    });
  });

  describe('findOne — resource-level scope', () => {
    it('managers cannot read a department outside their scope (404, opaque)', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-A']);
      mocks.prisma.department.findFirst.mockResolvedValue(departmentRow({ id: 'dept-B' }));

      await expect(service.findOne(actor(Role.MANAGER), 'dept-B')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('managers can read departments inside their scope', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-1']);
      mocks.prisma.department.findFirst.mockResolvedValue(departmentRow());

      await expect(service.findOne(actor(Role.MANAGER), 'dept-1')).resolves.toMatchObject({
        id: 'dept-1',
      });
    });

    it('admins can read any department', async () => {
      mocks.prisma.department.findFirst.mockResolvedValue(departmentRow());

      await expect(service.findOne(actor(Role.ADMIN), 'dept-any')).resolves.toMatchObject({
        id: 'dept-1',
      });
    });

    it('unknown ids still 404', async () => {
      mocks.prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.findOne(actor(Role.ADMIN), 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
  // The mutation guards use assertCanManageOrg (admin-only) — prove a viewer
  // or manager cannot create departments regardless of scope claims.
  describe('mutations — admin only', () => {
    it('create throws for managers and viewers via assertCanManageOrg', async () => {
      mocks.rbac.assertCanManageOrg.mockImplementation(() => {
        throw new ForbiddenException('Only admins can manage organization structure');
      });
      const dto = { name: 'X', managerUserId: undefined } as never;

      await expect(service.create(actor(Role.MANAGER), dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.create(actor(Role.VIEWER), dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mocks.prisma.department.create).not.toHaveBeenCalled();
    });
  });
});
