import { type PrismaService } from '@app/database/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/** Minimal Prisma stub — `$queryRaw` powers the database health probe. */
const prismaMock = {
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    prismaMock.$queryRaw.mockClear().mockResolvedValue([{ '?column?': 1 }]);
    const appService = new AppService(prismaMock as unknown as PrismaService);
    appController = new AppController(appService);
  });

  describe('getHealth', () => {
    it('should report ok with the database up', async () => {
      const health = await appController.getHealth();

      expect(health.status).toBe('ok');
      expect(health.db).toBe('up');
      expect(health.service).toBe('orgwise-api');
      expect(typeof health.timestamp).toBe('string');
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should degrade when the database is unreachable', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

      const health = await appController.getHealth();

      expect(health.status).toBe('degraded');
      expect(health.db).toBe('down');
    });
  });
});
