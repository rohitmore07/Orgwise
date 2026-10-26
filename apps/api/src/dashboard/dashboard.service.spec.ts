import { Role } from '@app/common/enums/role.enum';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { type RbacService } from '@app/common/services/rbac.service';
import { type PrismaService } from '@app/database/prisma.service';
import { DashboardService } from './dashboard.service';
// Unit tests for the dashboard aggregation: RBAC scoping (managers only see their departments) and slice…
// filters must land in the generated `where` clauses so analytics can never leak outside a caller's scope.
describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    employee: { count: jest.Mock; groupBy: jest.Mock; findMany: jest.Mock };
    department: { count: jest.Mock; findMany: jest.Mock };
    team: { count: jest.Mock };
  };
  let rbac: { departmentScope: jest.Mock };

  const actor: RequestUser = { sub: 'user-1', email: 'u@example.com', roles: [Role.ADMIN] };

  beforeEach(() => {
    prisma = {
      employee: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
      department: { count: jest.fn(), findMany: jest.fn() },
      team: { count: jest.fn() },
    };
    rbac = { departmentScope: jest.fn().mockResolvedValue(null) };

    prisma.employee.count.mockResolvedValue(42);
    prisma.department.count.mockResolvedValue(3);
    prisma.team.count.mockResolvedValue(5);
    prisma.department.findMany.mockResolvedValue([{ id: 'd1', name: 'Engineering' }]);
    prisma.employee.groupBy.mockImplementation(async ({ by }: { by: string[] }) => {
      if (by[0] === 'departmentId') {
        return [{ departmentId: 'd1', _count: { _all: 10 } }];
      }
      if (by[0] === 'status') {
        return [{ status: 'active', _count: { _all: 30 } }];
      }
      return [{ gender: 'female', _count: { _all: 15 } }];
    });
    prisma.employee.findMany.mockResolvedValue([]);

    service = new DashboardService(
      prisma as unknown as PrismaService,
      rbac as unknown as RbacService,
    );
  });

  describe('RBAC scoping', () => {
    it('admins are not department-scoped', async () => {
      await service.getOverview(actor);

      const where = prisma.employee.count.mock.calls[0][0].where;
      expect(where.deletedAt).toBeNull();
      expect(where.departmentId).toBeUndefined();
      // The department option list covers the whole org for admins.
      const deptWhere = prisma.department.findMany.mock.calls[0][0].where;
      expect(deptWhere.id).toBeUndefined();
    });

    it('managers are scoped to their assigned departments', async () => {
      const manager: RequestUser = {
        sub: 'user-2',
        email: 'm@example.com',
        roles: [Role.MANAGER],
      };
      rbac.departmentScope.mockResolvedValue(['d1', 'd2']);

      await service.getOverview(manager);

      const where = prisma.employee.count.mock.calls[0][0].where;
      expect(where.departmentId).toEqual({ in: ['d1', 'd2'] });
      // Manager's filter dropdown is restricted to the same scope.
      const deptWhere = prisma.department.findMany.mock.calls[0][0].where;
      expect(deptWhere.id).toEqual({ in: ['d1', 'd2'] });
    });
  });

  describe('slice filters', () => {
    it('applies department/status/gender filters to the employee where clause', async () => {
      await service.getOverview(actor, {
        departmentId: 'd1',
        status: 'active',
        gender: 'female',
      });

      const where = prisma.employee.count.mock.calls[0][0].where;
      expect(where.departmentId).toBe('d1');
      expect(where.status).toBe('active');
      expect(where.gender).toBe('female');
    });

    it('an out-of-scope department filter yields nothing (scope cannot widen)', async () => {
      const manager: RequestUser = {
        sub: 'user-2',
        email: 'm@example.com',
        roles: [Role.MANAGER],
      };
      rbac.departmentScope.mockResolvedValue(['d1', 'd2']);

      await service.getOverview(manager, { departmentId: 'd-other' });

      const where = prisma.employee.count.mock.calls[0][0].where;
      // Empty IN — the manager must never see another department's data.
      expect(where.departmentId).toEqual({ in: [] });
      // The org KPIs follow the same empty intersection.
      const orgWhere = prisma.department.count.mock.calls[0][0].where;
      expect(orgWhere.id).toEqual({ in: [] });
    });

    it('an in-scope department filter narrows without dropping the scope', async () => {
      const manager: RequestUser = {
        sub: 'user-2',
        email: 'm@example.com',
        roles: [Role.MANAGER],
      };
      rbac.departmentScope.mockResolvedValue(['d1', 'd2']);

      await service.getOverview(manager, { departmentId: 'd1' });

      const where = prisma.employee.count.mock.calls[0][0].where;
      expect(where.departmentId).toBe('d1');
    });

    it('returns scope-aware department options and mapped distributions', async () => {
      const overview = await service.getOverview(actor);

      expect(overview.kpis.totalEmployees).toBe(42);
      expect(overview.departments).toEqual([{ id: 'd1', name: 'Engineering' }]);
      expect(overview.departmentDistribution[0]).toMatchObject({ name: 'Engineering', value: 10 });
    });
  });
});
