import type { LLMProvider } from './llm-provider.interface';
import { LLMProviderError } from './llm-provider.interface';

export type { LLMProvider };
export { LLMProviderError };

/** DI token for the configured LLM provider (see `CopilotModule`). */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
