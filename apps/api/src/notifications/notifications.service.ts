import { Injectable } from '@nestjs/common';
import type { ImportStatus, NotificationItem } from '@orgwise/types';
import type { Prisma } from '@prisma/client';
import { RbacService } from '@app/common/services/rbac.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { PrismaService } from '@app/database/prisma.service';

/** Lightweight activity feed for the topbar bell: recent imports + the caller's own audit actions. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async findAll(actor: RequestUser, limit: number): Promise<NotificationItem[]> {
    const take = Math.min(Math.max(limit, 1), 20);

    const importWhere: Prisma.ImportHistoryWhereInput = this.rbac.isAdmin(actor)
      ? {}
      : { importedByUserId: actor.sub };
    const [imports, auditLogs] = await this.prisma.$transaction([
      this.prisma.importHistory.findMany({
        where: importWhere,
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          fileName: true,
          status: true,
          totalRows: true,
          successCount: true,
          failedCount: true,
          createdAt: true,
        },
      }),
      // Only the caller's OWN audit actions — safe for every role.
      this.prisma.auditLog.findMany({
        where: { actorUserId: actor.sub },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
    ]);

    const items: NotificationItem[] = [
      ...imports.map((i) => this.importToItem(i)),
      ...auditLogs.map((a) => this.auditToItem(a)),
    ];

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, take);
  }

  private importToItem(i: {
    id: string;
    fileName: string;
    status: ImportStatus;
    totalRows: number;
    successCount: number;
    failedCount: number;
    createdAt: Date;
  }): NotificationItem {
    const failed = i.failedCount > 0;
    return {
      id: `import:${i.id}`,
      type: 'import',
      title:
        i.status === 'failed'
          ? `Import failed — ${i.fileName}`
          : failed
            ? `Import finished with errors — ${i.fileName}`
            : `Import completed — ${i.fileName}`,
      description: `${i.successCount} of ${i.totalRows} records imported${
        failed ? `, ${i.failedCount} failed` : ''
      }`,
      createdAt: i.createdAt.toISOString(),
      link: '/imports',
      severity: i.status === 'failed' ? 'danger' : failed ? 'warning' : 'success',
    };
  }

  private auditToItem(a: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: Date;
  }): NotificationItem {
    const label = `${a.action} ${a.entityType}`;
    const link = a.entityType === 'employee' && a.entityId ? `/employees/${a.entityId}` : undefined;
    return {
      id: `audit:${a.id}`,
      type: 'audit',
      title: `You ${label.replace(/_/g, ' ')}`,
      description: a.entityId ?? '',
      createdAt: a.createdAt.toISOString(),
      link,
      severity: a.action === 'delete' ? 'danger' : 'info',
    };
  }
}
