import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AuditAction,
  AuditEntityType,
  AuditLogView,
  JsonValue,
  Paginated,
} from '@orgwise/types';
import { PrismaService } from '@app/database/prisma.service';
import type { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

/** Entity types that can be audited. */
export type { AuditEntityType };

/** Human-action label stored on each audit row. */
export type { AuditAction };
// Basic audit trail for state-changing operations. Writes are best-effort: audit failures must never fail the…
// primary operation, so errors are logged and swallowed. This keeps the audit layer invisible to the request…
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    actorUserId: string | null,
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string | null,
    details?: Prisma.InputJsonValue,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { actorUserId, action, entityType, entityId, details, ipAddress },
      });
    } catch (error) {
      this.logger.warn(
        `Audit write failed for ${entityType}#${entityId ?? '?'} (${action}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** List the audit trail — paginated, with action/entity/actor filters. */
  async findAll(query: QueryAuditLogsDto): Promise<Paginated<AuditLogView>> {
    const { page, pageSize, action, entityType, search } = query;

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(search
        ? {
            OR: [
              { actorUser: { name: { contains: search, mode: 'insensitive' } } },
              { actorUser: { email: { contains: search, mode: 'insensitive' } } },
              { entityId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actorUser: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id,
        actorUserId: log.actorUserId,
        actor: log.actorUser
          ? { id: log.actorUser.id, name: log.actorUser.name, email: log.actorUser.email }
          : null,
        action: log.action as AuditAction,
        entityType: log.entityType as AuditEntityType,
        entityId: log.entityId,
        details: (log.details as JsonValue | null) ?? null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
