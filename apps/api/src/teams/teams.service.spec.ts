import { NotFoundException } from '@nestjs/common';
import type { Team } from '@prisma/client';
import type { AuditService } from '@app/audit/audit.service';
import type { RbacService } from '@app/common/services/rbac.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { Role } from '@app/common/enums/role.enum';
import type { PrismaService } from '@app/database/prisma.service';
import { TeamsService } from './teams.service';

const actor = (role: Role): RequestUser => ({
  sub: 'user-1',
  email: 'user@orgwise.com',
  roles: [role],
});

function teamRow(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    name: 'Platform',
    description: null,
    isActive: true,
    departmentId: 'dept-1',
    leadEmployeeId: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Team;
}

function createMocks() {
  const prisma = {
    team: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    department: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
  };
  const rbac = {
    departmentScope: jest.fn().mockResolvedValue(null),
    isAdmin: jest.fn().mockReturnValue(true),
    assertCanManageOrg: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { prisma, rbac, audit };
}

describe('TeamsService', () => {
  let mocks: ReturnType<typeof createMocks>;
  let service: TeamsService;

  beforeEach(() => {
    mocks = createMocks();
    service = new TeamsService(
      mocks.prisma as unknown as PrismaService,
      mocks.rbac as unknown as RbacService,
      mocks.audit as unknown as AuditService,
    );
  });

  describe('findAll — scope', () => {
    it('admins and viewers see teams across all departments', async () => {
      mocks.prisma.team.findMany.mockResolvedValue([teamRow()]);

      await service.findAll(actor(Role.ADMIN));
      expect(mocks.prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );

      await service.findAll(actor(Role.VIEWER));
      expect(mocks.prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('managers only see teams within their department scope', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-1', 'dept-2']);
      mocks.prisma.team.findMany.mockResolvedValue([teamRow()]);

      await service.findAll(actor(Role.MANAGER));

      expect(mocks.prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, departmentId: { in: ['dept-1', 'dept-2'] } },
        }),
      );
    });

    it('an explicit in-scope department filter narrows the manager list', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-1', 'dept-2']);
      mocks.prisma.team.findMany.mockResolvedValue([teamRow()]);

      await service.findAll(actor(Role.MANAGER), 'dept-1');

      expect(mocks.prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, departmentId: 'dept-1' },
        }),
      );
    });

    it('an out-of-scope department filter matches NOTHING (never widens)', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-1']);
      mocks.prisma.team.findMany.mockResolvedValue([]);

      const result = await service.findAll(actor(Role.MANAGER), 'dept-other');

      expect(result).toEqual([]);
      expect(mocks.prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, departmentId: { in: [] } } }),
      );
    });

    it('a manager with an EMPTY scope sees zero teams (never all)', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue([]);
      mocks.prisma.team.findMany.mockResolvedValue([]);

      const result = await service.findAll(actor(Role.MANAGER));

      expect(result).toEqual([]);
      expect(mocks.prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, departmentId: { in: [] } } }),
      );
    });
  });

  describe('findOne — resource-level scope', () => {
    it('managers cannot read a team outside their scope (404, opaque)', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-A']);
      mocks.prisma.team.findFirst.mockResolvedValue(
        teamRow({ id: 'team-x', departmentId: 'dept-B' }),
      );

      await expect(service.findOne(actor(Role.MANAGER), 'team-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('managers can read teams inside their scope', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-1']);
      mocks.prisma.team.findFirst.mockResolvedValue(teamRow());

      await expect(service.findOne(actor(Role.MANAGER), 'team-1')).resolves.toMatchObject({
        id: 'team-1',
      });
    });

    it('admins can read any team', async () => {
      mocks.prisma.team.findFirst.mockResolvedValue(teamRow());

      await expect(service.findOne(actor(Role.ADMIN), 'team-any')).resolves.toMatchObject({
        id: 'team-1',
      });
    });

    it('unknown ids still 404', async () => {
      mocks.prisma.team.findFirst.mockResolvedValue(null);

      await expect(service.findOne(actor(Role.ADMIN), 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
