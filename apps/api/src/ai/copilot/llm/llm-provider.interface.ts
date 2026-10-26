// LLM provider abstraction — the copilot depends on this interface, never on a concrete SDK, so providers are…
// swappable via `AI_PROVIDER` and mockable in tests without network access.

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  /** Immutable system instructions — assembled by the copilot, never by user input. */
  system: string;
  /** Conversation turns. User content is treated as untrusted data. */
  messages: LLMMessage[];
  /** Ask the provider for a JSON object payload (parsed defensively). */
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMCompletion {
  content: string;
  usage?: LLMUsage;
  /** Which provider actually served the completion (for fallback chains). */
  provider?: string;
  model?: string;
}

/** One entry of the provider chain, for capabilities + observability. */
export interface ProviderDescriptor {
  name: string;
  model: string;
  configured: boolean;
}

/** Stable failure categories the copilot maps to user-friendly errors. */
export type LLMErrorKind =
  | 'auth' // provider rejected the key
  | 'rate' // provider rate-limited us
  | 'timeout' // provider did not answer in time
  | 'network' // transport failure
  | 'response' // malformed / unparseable completion
  | 'unconfigured'; // no API key configured

export class LLMProviderError extends Error {
  constructor(
    readonly kind: LLMErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export interface LLMProvider {
  readonly name: string;
  /** The model this provider serves (for provenance/UI). */
  readonly model: string;
  /** False when no API key is configured — the copilot degrades gracefully. */
  isConfigured(): boolean;
  /** Ordered chain description — a single provider returns just itself. */
  describeProviders(): ProviderDescriptor[];
  complete(request: LLMCompletionRequest): Promise<LLMCompletion>;
}
