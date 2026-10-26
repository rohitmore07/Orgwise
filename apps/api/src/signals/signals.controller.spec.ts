import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database/prisma.service';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';

describe('SignalsController', () => {
  let controller: SignalsController;

  beforeEach(async () => {
    const prisma = {
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      team: { count: jest.fn().mockResolvedValue(0) },
      hiringRecord: { count: jest.fn().mockResolvedValue(0) },
      importHistory: { count: jest.fn().mockResolvedValue(0) },
      aiConversation: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SignalsController],
      providers: [SignalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = moduleRef.get<SignalsController>(SignalsController);
  });

  describe('getLive', () => {
    it('should return a live signals snapshot', async () => {
      const snapshot = await controller.getLive();

      expect(snapshot.signalsTotal).toBe(0);
      expect(snapshot.healthScore).toBe(0);
      expect(snapshot.healthScore).toBeLessThanOrEqual(100);
      expect(Number.isNaN(Date.parse(snapshot.generatedAt))).toBe(false);
    });
  });
});
