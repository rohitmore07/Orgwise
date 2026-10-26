import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ProviderSettings } from '../copilot.config';
import {
  LLMProviderError,
  type LLMCompletion,
  type LLMCompletionRequest,
  type LLMProvider,
  type ProviderDescriptor,
} from './llm-provider.interface';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string };
}
// OpenAI-compatible chat-completions provider — a thin `fetch` client (no SDK dependency) so any…
// OpenAI-compatible endpoint works: OpenAI, Groq, OpenRouter, Azure, local gateways. Includes timeout, bounded…
export class OpenAiProvider implements LLMProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly settings: ProviderSettings) {}

  get name(): string {
    return this.settings.name;
  }

  get model(): string {
    return this.settings.model;
  }

  isConfigured(): boolean {
    return this.settings.apiKey.trim().length > 0;
  }

  describeProviders(): ProviderDescriptor[] {
    return [
      { name: this.settings.name, model: this.settings.model, configured: this.isConfigured() },
    ];
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    if (!this.isConfigured()) {
      throw new LLMProviderError('unconfigured', 'No AI API key configured');
    }

    const payload = {
      model: this.settings.model,
      messages: [
        { role: 'system', content: request.system },
        ...request.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? this.settings.maxTokens,
      ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };

    let lastError: LLMProviderError | null = null;
    const attempts = this.settings.maxRetries + 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) {
        await sleep(this.backoffMs(attempt));
      }
      try {
        return await this.callOnce(payload);
      } catch (error) {
        lastError = toProviderError(error);
        // Auth failures will not recover on retry; everything else retries.
        if (lastError.kind === 'auth') break;
        if (attempt === attempts - 1) break;
        this.logger.warn(
          `LLM call failed (${this.settings.name}, attempt ${attempt + 1}/${attempts}): ${lastError.message}`,
        );
      }
    }

    throw lastError ?? new LLMProviderError('network', 'LLM call failed');
  }

  private async callOnce(payload: unknown): Promise<LLMCompletion> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.settings.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.apiKey}`,
          'X-Request-Id': randomUUID(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMProviderError('timeout', 'LLM request timed out');
      }
      throw new LLMProviderError('network', `LLM request failed: ${messageOf(error)}`);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new LLMProviderError('auth', `LLM rejected the API key (${response.status})`);
    }
    if (response.status === 429) {
      throw new LLMProviderError('rate', 'LLM rate limit reached');
    }
    if (response.status >= 500) {
      throw new LLMProviderError('network', `LLM server error (${response.status})`);
    }
    if (!response.ok) {
      // Some free models reject strict JSON mode with a 400 — retry once
      // without `response_format` and parse the plan tolerantly instead.
      const errorMessage = await responseError(response);
      const isJsonModeRejection =
        response.status === 400 &&
        isJsonModePayload(payload) &&
        /response_format|json object|json_mode|structured output/i.test(errorMessage);
      if (isJsonModeRejection) {
        this.logger.warn(`${this.settings.name} rejected strict JSON mode — retrying without it`);
        return this.callOnce(stripJsonMode(payload));
      }
      throw new LLMProviderError(
        'response',
        `LLM request failed (${response.status})${errorMessage ? `: ${errorMessage}` : ''}`,
      );
    }

    const body = (await response.json()) as ChatCompletionResponse;
    if (body.error?.message) {
      throw new LLMProviderError('response', `LLM error: ${body.error.message}`);
    }

    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new LLMProviderError('response', 'LLM returned an empty completion');
    }

    return {
      content,
      usage: body.usage
        ? {
            promptTokens: body.usage.prompt_tokens ?? 0,
            completionTokens: body.usage.completion_tokens ?? 0,
            totalTokens: body.usage.total_tokens ?? 0,
          }
        : undefined,
      provider: this.settings.name,
      model: this.settings.model,
    };
  }

  private backoffMs(attempt: number): number {
    // 250ms * 2^(attempt-1) with ±20% jitter.
    const base = 250 * 2 ** (attempt - 1);
    return Math.round(base * (0.8 + Math.random() * 0.4));
  }
}

/** True when the outgoing payload asked for `response_format: json_object`. */
function isJsonModePayload(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'response_format' in payload &&
    (payload as { response_format?: unknown }).response_format !== undefined
  );
}

function stripJsonMode(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) return payload;
  const rest = { ...(payload as Record<string, unknown>) };
  delete rest.response_format;
  return rest;
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? '';
  } catch {
    return '';
  }
}

function toProviderError(error: unknown): LLMProviderError {
  return error instanceof LLMProviderError
    ? error
    : new LLMProviderError('network', messageOf(error));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
