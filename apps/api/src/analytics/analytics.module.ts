import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
// Workforce-intelligence module — AnalyticsController → AnalyticsService → AnalyticsRepository → Database.…
// Calculation logic lives in the service as pure functions so it is unit-testable without a database.
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
  // Exported so the AI Copilot can call the analytics engine as a trusted tool.
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
