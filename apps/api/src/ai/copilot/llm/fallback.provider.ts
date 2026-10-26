import { Logger } from '@nestjs/common';
import {
  LLMProviderError,
  type LLMCompletion,
  type LLMCompletionRequest,
  type LLMProvider,
  type ProviderDescriptor,
} from './llm-provider.interface';
// Provider chain with automatic failover. Holds an ordered list of providers (primary first). Each `complete()`…
// call walks the chain: the first configured provider that succeeds serves the request; on ANY failure (rate…
export class FallbackProvider implements LLMProvider {
  private readonly logger = new Logger(FallbackProvider.name);

  readonly name = 'fallback';

  constructor(private readonly providers: LLMProvider[]) {}

  get model(): string {
    return this.providers
      .filter((p) => p.isConfigured())
      .map((p) => `${p.name}:${p.model}`)
      .join(' + ');
  }

  isConfigured(): boolean {
    return this.providers.some((p) => p.isConfigured());
  }

  describeProviders(): ProviderDescriptor[] {
    return this.providers.flatMap((p) => p.describeProviders());
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    let lastError: LLMProviderError | null = null;

    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;

      try {
        const completion = await provider.complete(request);
        // Tag the completion with who actually served it.
        return {
          ...completion,
          provider: provider.name,
          model: provider.model,
        };
      } catch (error) {
        lastError = toError(error);
        this.logger.warn(
          `Provider ${provider.name} (${provider.model}) failed with "${lastError.kind}" — trying next provider`,
        );
      }
    }

    throw (
      lastError ??
      new LLMProviderError('unconfigured', 'No AI provider is configured with an API key')
    );
  }
}

function toError(error: unknown): LLMProviderError {
  return error instanceof LLMProviderError
    ? error
    : new LLMProviderError('network', error instanceof Error ? error.message : String(error));
}
