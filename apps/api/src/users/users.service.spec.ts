import { BadRequestException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuditService } from '@app/audit/audit.service';
import { Role } from '@app/common/enums/role.enum';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import type { PrismaService } from '@app/database/prisma.service';
import { UsersService } from './users.service';

const actor: RequestUser = { sub: 'user-1', email: 'admin@orgwise.com', roles: [Role.ADMIN] };

function userRow(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'user@orgwise.com',
    name: 'User',
    role: 'viewer',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as User;
}

function createMocks() {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { prisma, audit };
}

describe('UsersService', () => {
  let mocks: ReturnType<typeof createMocks>;
  let service: UsersService;

  beforeEach(() => {
    mocks = createMocks();
    service = new UsersService(
      mocks.prisma as unknown as PrismaService,
      mocks.audit as unknown as AuditService,
    );
  });

  describe('findAll — role filter', () => {
    it('passes a comma-separated role filter through to the query (server-side filtering)', async () => {
      mocks.prisma.user.findMany.mockResolvedValue([userRow({ role: 'manager' })]);

      await service.findAll(actor, undefined, 'manager,admin');

      expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: { in: ['manager', 'admin'] } }),
        }),
      );
    });

    it('combines the role filter with the search filter', async () => {
      mocks.prisma.user.findMany.mockResolvedValue([userRow()]);

      await service.findAll(actor, 'alex', 'manager');

      expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: { in: ['manager'] },
            OR: [
              { name: { contains: 'alex', mode: 'insensitive' } },
              { email: { contains: 'alex', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('dedupes repeated roles and tolerates surrounding whitespace', async () => {
      mocks.prisma.user.findMany.mockResolvedValue([userRow()]);

      await service.findAll(actor, undefined, ' admin , admin ');

      expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ role: { in: ['admin'] } }) }),
      );
    });

    it('rejects an all-invalid role filter instead of returning everything', async () => {
      await expect(service.findAll(actor, undefined, 'boss')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('omits the role constraint when no role filter is given', async () => {
      mocks.prisma.user.findMany.mockResolvedValue([userRow()]);

      await service.findAll(actor);

      expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          where: expect.objectContaining({ role: expect.anything() }),
        }),
      );
    });
  });
});
