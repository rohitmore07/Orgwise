import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '@app/database/prisma.service';
import { RbacService } from './rbac.service';
import { Role } from '../enums/role.enum';
import type { RequestUser } from '../interfaces/request-user.interface';

const actor = (role: Role): RequestUser => ({
  sub: 'user-1',
  email: 'user@example.com',
  roles: [role],
});

/** Minimal Prisma facade — only the department methods RbacService touches. */
function createPrismaMock() {
  return {
    department: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe('RbacService', () => {
  let prisma: PrismaMock;
  let service: RbacService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new RbacService(prisma as unknown as PrismaService);
  });

  describe('canWrite', () => {
    it('allows admin and manager, denies viewer', () => {
      expect(service.canWrite(actor(Role.ADMIN))).toBe(true);
      expect(service.canWrite(actor(Role.MANAGER))).toBe(true);
      expect(service.canWrite(actor(Role.VIEWER))).toBe(false);
    });
  });

  describe('departmentScope', () => {
    it('returns null for admins and viewers (no scoping)', async () => {
      expect(await service.departmentScope(actor(Role.ADMIN))).toBeNull();
      expect(await service.departmentScope(actor(Role.VIEWER))).toBeNull();
    });

    it('returns the departments a manager manages', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 'dept-1' }, { id: 'dept-2' }]);

      await expect(service.departmentScope(actor(Role.MANAGER))).resolves.toEqual([
        'dept-1',
        'dept-2',
      ]);
      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { managerUserId: 'user-1', deletedAt: null } }),
      );
    });

    it('returns an EMPTY array for a manager with no assigned departments (zero access, never full access)', async () => {
      // An empty scope must mean "nothing in scope". Services gate reads on the scope value (`scope ? { id: { in:…
      // scope } } : {}`); since `[]` is truthy this becomes `{ id: { in: [] } }` — matches zero rows — instead of the…
      prisma.department.findMany.mockResolvedValue([]);

      await expect(service.departmentScope(actor(Role.MANAGER))).resolves.toEqual([]);
    });
  });

  describe('isDepartmentInScope', () => {
    it('admins can access any department', async () => {
      await expect(service.isDepartmentInScope(actor(Role.ADMIN), 'dept-x')).resolves.toBe(true);
    });

    it('viewers can access nothing', async () => {
      await expect(service.isDepartmentInScope(actor(Role.VIEWER), 'dept-x')).resolves.toBe(false);
    });

    it('managers can access only their own departments', async () => {
      prisma.department.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await expect(service.isDepartmentInScope(actor(Role.MANAGER), 'mine')).resolves.toBe(true);
      await expect(service.isDepartmentInScope(actor(Role.MANAGER), 'theirs')).resolves.toBe(false);
    });
  });

  describe('assertCanWrite', () => {
    it('rejects viewers regardless of department', async () => {
      await expect(service.assertCanWrite(actor(Role.VIEWER), 'dept-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects managers acting outside their scope', async () => {
      prisma.department.count.mockResolvedValue(0);

      await expect(service.assertCanWrite(actor(Role.MANAGER), 'dept-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('allows managers within scope and admins anywhere', async () => {
      prisma.department.count.mockResolvedValue(1);
      await expect(service.assertCanWrite(actor(Role.MANAGER), 'dept-1')).resolves.toBeUndefined();

      await expect(service.assertCanWrite(actor(Role.ADMIN), 'dept-1')).resolves.toBeUndefined();
    });
  });
});
