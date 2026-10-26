import { Module } from '@nestjs/common';
import { AnalyticsModule } from '@app/analytics/analytics.module';
import { EmployeesModule } from '@app/employees/employees.module';
import { ImportsModule } from '@app/imports/imports.module';
import { CopilotConfig } from './copilot.config';
import { CopilotController } from './copilot.controller';
import { CopilotMetricsService } from './copilot.metrics.service';
import { CopilotRateLimiter } from './copilot.rate-limiter';
import { CopilotService } from './copilot.service';
import { CopilotToolsService } from './tools/copilot-tools.service';
import { FallbackProvider } from './llm/fallback.provider';
import { OpenAiProvider } from './llm/openai.provider';
import { LLM_PROVIDER, type LLMProvider } from './llm/llm-provider.token';
// AI Copilot module. The LLM is injected behind the `LLM_PROVIDER` token so the chain is swappable and…
// trivially mockable in tests. The factory builds an ordered provider chain (primary → Groq → OpenRouter; all…
@Module({
  imports: [AnalyticsModule, EmployeesModule, ImportsModule],
  controllers: [CopilotController],
  providers: [
    CopilotConfig,
    CopilotToolsService,
    CopilotService,
    CopilotRateLimiter,
    CopilotMetricsService,
    {
      provide: LLM_PROVIDER,
      inject: [CopilotConfig],
      useFactory: (config: CopilotConfig): LLMProvider => {
        const chain = config.providerChain().map((settings) => new OpenAiProvider(settings));
        return chain.length === 1 ? chain[0]! : new FallbackProvider(chain);
      },
    },
  ],
})
export class CopilotModule {}
