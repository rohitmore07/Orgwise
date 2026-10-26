import { NotificationsService } from './notifications.service';

const ADMIN = { sub: 'user-1', email: 'admin@orgwise.dev', roles: ['admin'] } as never;
const MANAGER = { sub: 'user-2', email: 'mgr@orgwise.dev', roles: ['manager'] } as never;

function createMocks() {
  const prisma = {
    importHistory: { findMany: jest.fn() },
    auditLog: { findMany: jest.fn() },
    $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const rbac = { isAdmin: jest.fn() };
  const service = new NotificationsService(prisma as never, rbac as never);
  return { prisma, rbac, service };
}

describe('NotificationsService', () => {
  it('scopes imports to the actor for non-admins', async () => {
    const { prisma, rbac, service } = createMocks();
    rbac.isAdmin.mockReturnValue(false);
    prisma.importHistory.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.findAll(MANAGER, 10);

    expect(prisma.importHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { importedByUserId: 'user-2' } }),
    );
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actorUserId: 'user-2' } }),
    );
  });

  it('shows all imports for admins', async () => {
    const { prisma, rbac, service } = createMocks();
    rbac.isAdmin.mockReturnValue(true);
    prisma.importHistory.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.findAll(ADMIN, 10);

    expect(prisma.importHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('maps imports with severity and merges audit entries newest-first', async () => {
    const { prisma, rbac, service } = createMocks();
    rbac.isAdmin.mockReturnValue(true);
    prisma.importHistory.findMany.mockResolvedValue([
      {
        id: 'imp-1',
        fileName: 'employees.csv',
        status: 'partial',
        totalRows: 100,
        successCount: 90,
        failedCount: 10,
        createdAt: new Date('2026-08-01T10:00:00Z'),
      },
    ]);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'aud-1',
        action: 'update',
        entityType: 'employee',
        entityId: 'emp-9',
        createdAt: new Date('2026-08-02T10:00:00Z'),
      },
    ]);

    const items = await service.findAll(ADMIN, 10);

    expect(items[0]).toMatchObject({
      id: 'audit:aud-1',
      type: 'audit',
      title: 'You update employee',
      link: '/employees/emp-9',
    });
    expect(items[1]).toMatchObject({
      id: 'import:imp-1',
      type: 'import',
      severity: 'warning',
      title: 'Import finished with errors — employees.csv',
      description: '90 of 100 records imported, 10 failed',
      link: '/imports',
    });
  });

  it('clamps the requested limit to 20', async () => {
    const { prisma, rbac, service } = createMocks();
    rbac.isAdmin.mockReturnValue(true);
    prisma.importHistory.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.findAll(ADMIN, 500);

    expect(prisma.importHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
  });
});
