import { Injectable, Logger } from '@nestjs/common';
import type { HealthStatus } from '@orgwise/types';
import { PrismaService } from '@app/database/prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}
  // Liveness + dependency health. `status` degrades when PostgreSQL is unreachable (the API itself is alive but…
  // not fully functional) so uptime monitors and the landing page can distinguish "down" from "degraded".
  async getHealth(): Promise<HealthStatus> {
    const db = await this.checkDatabase();
    return {
      status: db ? 'ok' : 'degraded',
      service: 'orgwise-api',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      db: db ? 'up' : 'down',
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      // Health probes are exempt from rate limiting and run frequently — log
      // at debug-ish severity (warn would flood when the DB is genuinely down).
      this.logger.debug(
        `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
