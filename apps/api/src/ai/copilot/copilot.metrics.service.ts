import { Injectable } from '@nestjs/common';
import type { LLMUsage, ProviderDescriptor } from './llm/llm-provider.interface';

export interface CopilotMetricsSnapshot {
  configured: boolean;
  /** Ordered provider chain with per-provider configuration state. */
  providers: ProviderDescriptor[];
  /** Successes served per provider name (fallback visibility). */
  providerSuccesses: Record<string, number>;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  rateLimitedCount: number;
  /** tool name → executions (no arguments or results recorded). */
  toolUsage: Record<string, number>;
  totalLatencyMs: number;
  averageLatencyMs: number;
  /** Token usage totals — only when the provider reports them. */
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Last error category — no message text, no user content. */
  lastErrorKind: string | null;
}
// Lightweight in-memory AI observability. Counters only — no prompts, answers or tool payloads are retained, so…
// sensitive workforce content never lands in operational state. Resets on process restart (acceptable for a…
@Injectable()
export class CopilotMetricsService {
  private providers: ProviderDescriptor[] = [];
  private readonly providerSuccesses = new Map<string, number>();
  private configured = false;
  private totalRequests = 0;
  private successCount = 0;
  private errorCount = 0;
  private rateLimitedCount = 0;
  private readonly toolUsage = new Map<string, number>();
  private totalLatencyMs = 0;
  private promptTokens = 0;
  private completionTokens = 0;
  private totalTokens = 0;
  private lastErrorKind: string | null = null;

  markConfigured(providers: ProviderDescriptor[]): void {
    this.providers = providers;
    this.configured = providers.some((p) => p.configured);
  }

  recordRequestStarted(): void {
    this.totalRequests += 1;
  }

  recordSuccess(
    latencyMs: number,
    tool: string | undefined,
    provider: string | undefined,
    usage?: LLMUsage,
  ): void {
    this.successCount += 1;
    this.totalLatencyMs += latencyMs;
    if (tool) {
      this.toolUsage.set(tool, (this.toolUsage.get(tool) ?? 0) + 1);
    }
    if (provider) {
      this.providerSuccesses.set(provider, (this.providerSuccesses.get(provider) ?? 0) + 1);
    }
    if (usage) {
      this.promptTokens += usage.promptTokens;
      this.completionTokens += usage.completionTokens;
      this.totalTokens += usage.totalTokens;
    }
  }

  recordError(latencyMs: number, kind: string): void {
    this.errorCount += 1;
    this.totalLatencyMs += latencyMs;
    this.lastErrorKind = kind;
  }

  recordRateLimited(): void {
    this.rateLimitedCount += 1;
  }

  snapshot(): CopilotMetricsSnapshot {
    return {
      configured: this.configured,
      providers: this.providers,
      providerSuccesses: Object.fromEntries(this.providerSuccesses),
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      errorCount: this.errorCount,
      rateLimitedCount: this.rateLimitedCount,
      toolUsage: Object.fromEntries(this.toolUsage),
      totalLatencyMs: this.totalLatencyMs,
      averageLatencyMs:
        this.successCount + this.errorCount > 0
          ? Math.round(this.totalLatencyMs / (this.successCount + this.errorCount))
          : 0,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.totalTokens,
      lastErrorKind: this.lastErrorKind,
    };
  }
}
