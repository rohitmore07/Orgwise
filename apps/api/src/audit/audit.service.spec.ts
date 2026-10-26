import type { PrismaService } from '@app/database/prisma.service';
import type { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AuditService } from './audit.service';

const logRow = {
  id: 'log-1',
  actorUserId: 'user-1',
  action: 'restore',
  entityType: 'employee',
  entityId: 'emp-1',
  details: { email: 'alex@orgwise.com', deletedAt: '2025-01-01T00:00:00.000Z' },
  ipAddress: '127.0.0.1',
  createdAt: new Date('2025-02-01T00:00:00.000Z'),
  actorUser: { id: 'user-1', name: 'Alex Admin', email: 'admin@orgwise.com' },
};

function createPrismaMock() {
  return {
    auditLog: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('AuditService.findAll', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: AuditService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AuditService(prisma as unknown as PrismaService);
    prisma.$transaction.mockResolvedValue([[logRow], 1]);
  });

  it('returns a paginated feed with the actor joined into the view', async () => {
    const result = await service.findAll({ page: 1, pageSize: 20 } as QueryAuditLogsDto);

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'log-1',
      action: 'restore',
      entityType: 'employee',
      entityId: 'emp-1',
      actor: { id: 'user-1', name: 'Alex Admin', email: 'admin@orgwise.com' },
      ipAddress: '127.0.0.1',
    });
    expect(result.items[0]!.createdAt).toBe('2025-02-01T00:00:00.000Z');
    expect(result.items[0]!.details).toEqual({
      email: 'alex@orgwise.com',
      deletedAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('passes action/entityType filters through to the query', async () => {
    await service.findAll({
      page: 1,
      pageSize: 20,
      action: 'restore',
      entityType: 'employee',
    } as QueryAuditLogsDto);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { action: 'restore', entityType: 'employee' } }),
    );
  });

  it('builds an actor/entity search OR-filter', async () => {
    await service.findAll({ page: 1, pageSize: 20, search: 'alex' } as QueryAuditLogsDto);

    const where = prisma.auditLog.findMany.mock.calls[0]![0]!.where as { OR: unknown[] };
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0]).toEqual({ actorUser: { name: { contains: 'alex', mode: 'insensitive' } } });
  });

  it('omits filters when none are provided', async () => {
    await service.findAll({ page: 1, pageSize: 20 } as QueryAuditLogsDto);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('renders a null actor as "System" input — null actor maps to null, not a crash', async () => {
    prisma.$transaction.mockResolvedValue([[{ ...logRow, actorUser: null }], 1]);

    const result = await service.findAll({ page: 1, pageSize: 20 } as QueryAuditLogsDto);

    expect(result.items[0]!.actor).toBeNull();
  });
});
