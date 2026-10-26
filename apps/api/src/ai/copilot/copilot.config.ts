import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Concrete connection settings for one OpenAI-compatible provider. */
export interface ProviderSettings {
  name: 'groq' | 'openrouter';
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  maxTokens: number;
}

/** Per-provider free-model defaults (used when AI_MODEL / *_MODEL are unset). */
const DEFAULT_MODELS: Record<ProviderSettings['name'], string> = {
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
};

const DEFAULT_BASE_URLS: Record<ProviderSettings['name'], string> = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

@Injectable()
export class CopilotConfig {
  constructor(private readonly config: ConfigService) {}

  get provider(): string {
    return this.config.get<string>('ai.provider') ?? 'groq';
  }

  get requestsPerMinute(): number {
    return this.config.get<number>('ai.requestsPerMinute') ?? 10;
  }

  get maxInputChars(): number {
    return this.config.get<number>('ai.maxInputChars') ?? 4000;
  }

  get timeoutMs(): number {
    return this.config.get<number>('ai.timeoutMs') ?? 30_000;
  }

  get maxRetries(): number {
    return this.config.get<number>('ai.maxRetries') ?? 2;
  }

  get maxTokens(): number {
    return this.config.get<number>('ai.maxTokens') ?? 2000;
  }

  /** Ordered provider chain — primary first, then configured fallbacks. */
  providerChain(): ProviderSettings[] {
    const common = {
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      maxTokens: this.maxTokens,
    };
    const primaryName: ProviderSettings['name'] =
      this.provider === 'openrouter' ? 'openrouter' : 'groq';

    const primaryApiKey =
      (this.config.get<string>('ai.apiKey') ?? '').trim() ||
      (this.config.get<string>(`ai.${primaryName}.apiKey`) ?? '').trim();
    const primaryModel =
      (this.config.get<string>('ai.model') ?? '').trim() ||
      (this.config.get<string>(`ai.${primaryName}.model`) ?? '').trim();
    const primaryBaseUrl =
      (this.config.get<string>('ai.baseUrl') ?? '').trim() ||
      (this.config.get<string>(`ai.${primaryName}.baseUrl`) ?? '').trim();

    const chain: ProviderSettings[] = [
      {
        name: primaryName,
        apiKey: primaryApiKey,
        model: this.modelFor(primaryName, primaryModel),
        baseUrl: this.baseUrlFor(primaryName, primaryBaseUrl),
        ...common,
      },
      {
        name: 'groq',
        apiKey: this.config.get<string>('ai.groq.apiKey') ?? '',
        model: this.modelFor('groq', this.config.get<string>('ai.groq.model') ?? ''),
        baseUrl: this.baseUrlFor('groq', this.config.get<string>('ai.groq.baseUrl') ?? ''),
        ...common,
      },
      {
        name: 'openrouter',
        apiKey: this.config.get<string>('ai.openrouter.apiKey') ?? '',
        model: this.modelFor('openrouter', this.config.get<string>('ai.openrouter.model') ?? ''),
        baseUrl: this.baseUrlFor(
          'openrouter',
          this.config.get<string>('ai.openrouter.baseUrl') ?? '',
        ),
        ...common,
      },
    ];

    // Dedupe: if the primary IS groq/openrouter, don't list it twice.
    const seen = new Set<string>();
    return chain.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }

  private modelFor(name: ProviderSettings['name'], configured: string): string {
    return configured.trim() || DEFAULT_MODELS[name];
  }

  private baseUrlFor(name: ProviderSettings['name'], configured: string): string {
    return configured.trim().replace(/\/+$/, '') || DEFAULT_BASE_URLS[name];
  }
}
