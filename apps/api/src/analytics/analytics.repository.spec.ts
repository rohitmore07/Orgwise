import type { PrismaService } from '@app/database/prisma.service';
import { AnalyticsRepository } from './analytics.repository';

const departments = [
  { id: 'd1', name: 'Engineering', parentId: null },
  { id: 'd2', name: 'Sales', parentId: null },
];
const teams = [{ id: 't1', name: 'Platform', departmentId: 'd1' }];

function employeeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    firstName: 'Alex',
    lastName: 'Morgan',
    jobTitle: 'Engineer',
    status: 'active',
    departmentId: 'd1',
    teamId: 't1',
    ...overrides,
  };
}

function createMocks(employees: ReturnType<typeof employeeRow>[] = []) {
  const prisma = {
    department: { findMany: jest.fn().mockResolvedValue(departments) },
    team: { findMany: jest.fn().mockResolvedValue(teams) },
    employee: { findMany: jest.fn().mockResolvedValue(employees) },
  };
  return prisma;
}

describe('AnalyticsRepository — getHierarchy search', () => {
  let repo: AnalyticsRepository;

  it('returns the full tree and employee count without a search term', async () => {
    const prisma = createMocks([
      employeeRow({ id: 'e1', teamId: 't1' }),
      employeeRow({ id: 'e2', departmentId: 'd2', teamId: null }),
    ]);
    repo = new AnalyticsRepository(prisma as unknown as PrismaService);

    const hierarchy = await repo.getHierarchy(null);

    expect(hierarchy.nodes).toHaveLength(2);
    const engineering = hierarchy.nodes.find((n) => n.name === 'Engineering')!;
    const platform = engineering.children[0]!;
    expect(platform.type).toBe('team');
    expect(platform.children[0]!.employee?.firstName).toBe('Alex');
    expect(hierarchy.totalEmployees).toBe(2);
    // No search → no OR filter in the employee query.
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });

  it('filters employees server-side and prunes the tree to matches, keeping ancestor paths', async () => {
    // With `search`, the employee query only returns matches — the repo then
    // prunes departments/teams that have no matching descendants.
    const prisma = createMocks([employeeRow({ id: 'e1', teamId: 't1' })]);
    repo = new AnalyticsRepository(prisma as unknown as PrismaService);

    const hierarchy = await repo.getHierarchy(null, 'alex');

    // Engineering → Platform → Alex kept; Sales (no matches) dropped.
    expect(hierarchy.nodes).toHaveLength(1);
    expect(hierarchy.nodes[0]!.name).toBe('Engineering');
    expect(hierarchy.nodes[0]!.children[0]!.name).toBe('Platform');
    expect(hierarchy.nodes[0]!.children[0]!.children).toHaveLength(1);
    expect(hierarchy.totalEmployees).toBe(1);
    // The search term is applied to the employee query (firstName/lastName/jobTitle).
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { firstName: { contains: 'alex', mode: 'insensitive' } },
            { lastName: { contains: 'alex', mode: 'insensitive' } },
            { jobTitle: { contains: 'alex', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('keeps a department whose name matches even when no employees match', async () => {
    const prisma = createMocks([]);
    repo = new AnalyticsRepository(prisma as unknown as PrismaService);

    const hierarchy = await repo.getHierarchy(null, 'sales');

    expect(hierarchy.nodes).toHaveLength(1);
    expect(hierarchy.nodes[0]!.name).toBe('Sales');
    expect(hierarchy.nodes[0]!.children).toEqual([]);
    expect(hierarchy.totalEmployees).toBe(0);
  });

  it('ANDs the manager scope with the search filter — no cross-scope leak', async () => {
    const prisma = createMocks([employeeRow()]);
    repo = new AnalyticsRepository(prisma as unknown as PrismaService);

    await repo.getHierarchy(['d1'], 'alex');

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departmentId: { in: ['d1'] },
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('returns distinct job titles for the filter bar without shipping employee rows', async () => {
    const prisma = createMocks([]);
    // The mock mirrors the DB's `distinct` behaviour — already-unique rows.
    prisma.employee.findMany.mockResolvedValue([{ jobTitle: 'Engineer' }, { jobTitle: 'Manager' }]);
    repo = new AnalyticsRepository(prisma as unknown as PrismaService);

    const titles = await repo.getJobTitles(null);

    expect(titles).toEqual(['Engineer', 'Manager']);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ['jobTitle'], select: { jobTitle: true } }),
    );
  });

  it('narrows getEmployeeRows to the given department ids for comparisons', async () => {
    const prisma = createMocks([employeeRow()]);
    repo = new AnalyticsRepository(prisma as unknown as PrismaService);

    await repo.getEmployeeRows(null, {}, ['d1', 'd2']);

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ departmentId: { in: ['d1', 'd2'] } }),
      }),
    );
  });

  it('returns the full tree untouched when the search term is empty/whitespace', async () => {
    const prisma = createMocks([
      employeeRow({ id: 'e1', teamId: 't1' }),
      employeeRow({ id: 'e2', departmentId: 'd2', teamId: null }),
    ]);
    repo = new AnalyticsRepository(prisma as unknown as PrismaService);

    const hierarchy = await repo.getHierarchy(null, '   ');

    expect(hierarchy.nodes).toHaveLength(2);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });
});
