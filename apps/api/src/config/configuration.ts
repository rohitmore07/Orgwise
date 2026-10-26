import { isProduction, type NodeEnv } from '../common/utils/env.util';

/** Typed view of the runtime configuration produced by the load factory. */
export interface AppConfig {
  env: NodeEnv;
  port: number;
  /** Comma-separated `CORS_ORIGINS` parsed into an explicit allowlist. */
  corsOrigins: string[];
  databaseUrl: string;
  auth: {
    /** Base URL of the Neon Auth (Managed Better Auth) server. */
    neonBaseUrl: string;
    /** How long a validated session stays cached in-memory (ms). */
    sessionCacheTtlMs: number;
    // Emails granted the Admin role at first contact and re-promoted on every session (comma-separated…
    // `ADMIN_EMAILS`, case-insensitive).
    bootstrapAdminEmails: string[];
  };
  /** Global rate limiting — keyed by user id when authenticated, IP otherwise. */
  rateLimit: {
    /** Window length in ms. */
    ttlMs: number;
    /** Maximum requests per key per window. */
    max: number;
  };
  /** AI Copilot (Phase 5) — provider chain + cost controls. */
  ai: {
    /** Primary provider name: groq | openrouter. */
    provider: string;
    /** Empty when not configured — the copilot reports "unavailable" instead of failing the dashboard. */
    apiKey: string;
    /** Empty → provider-specific free-model default (see CopilotConfig). */
    model: string;
    /** Empty → provider-specific default endpoint (see CopilotConfig). */
    baseUrl: string;
    /** Fallback providers (OpenAI-compatible), tried after the primary. */
    groq: { apiKey: string; model: string; baseUrl: string };
    openrouter: { apiKey: string; model: string; baseUrl: string };
    /** Per-user copilot requests per minute (sliding window). */
    requestsPerMinute: number;
    /** Longest accepted user message (chars) — input cost control. */
    maxInputChars: number;
    /** Provider call timeout in ms. */
    timeoutMs: number;
    /** Transient-failure retries per provider call. */
    maxRetries: number;
    /** Max tokens per completion. */
    maxTokens: number;
  };
  /** Trust X-Forwarded-For from loopback proxies (behind a reverse proxy). */
  trustProxy: boolean;
  swagger: {
    enabled: boolean;
    path: string;
  };
  requestLogging: {
    enabled: boolean;
  };
}
// Loads a typed configuration object once at bootstrap. Values come from the environment (already validated by…
// `env.validation.ts`); `ConfigService` then exposes them type-safely via `config.get('jwt.secret')`.
export default (): AppConfig => ({
  env: (process.env.NODE_ENV as NodeEnv | undefined) ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '3001', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL ?? '',
  auth: {
    neonBaseUrl: (process.env.NEON_AUTH_BASE_URL ?? '').replace(/\/+$/, ''),
    sessionCacheTtlMs: Number.parseInt(process.env.SESSION_CACHE_TTL_MS ?? '60000', 10),
    bootstrapAdminEmails: (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  },
  rateLimit: {
    ttlMs: Number.parseInt(process.env.RATE_LIMIT_TTL_MS ?? '60000', 10),
    max: Number.parseInt(process.env.RATE_LIMIT_MAX ?? '120', 10),
  },
  ai: {
    provider: (process.env.AI_PROVIDER ?? 'groq').trim().toLowerCase(),
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? '',
    baseUrl: (process.env.AI_BASE_URL ?? '').replace(/\/+$/, ''),
    groq: {
      apiKey: process.env.GROQ_API_KEY ?? '',
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      baseUrl: (process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      model: process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free',
      baseUrl: (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(
        /\/+$/,
        '',
      ),
    },
    requestsPerMinute: Number.parseInt(process.env.AI_REQUESTS_PER_MINUTE ?? '10', 10),
    maxInputChars: Number.parseInt(process.env.AI_MAX_INPUT_CHARS ?? '4000', 10),
    timeoutMs: Number.parseInt(process.env.AI_TIMEOUT_MS ?? '30000', 10),
    maxRetries: Number.parseInt(process.env.AI_MAX_RETRIES ?? '2', 10),
    maxTokens: Number.parseInt(process.env.AI_MAX_TOKENS ?? '2000', 10),
  },
  trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  swagger: {
    // Same truthy/falsy semantics as the Joi schema so the factory and the validated contract can never disagree…
    // ('0' and 'false' are both off). Off by default in production — docs must be an explicit opt-in.
    enabled: parseBoolean(process.env.SWAGGER_ENABLED, !isProduction(process.env.NODE_ENV)),
    path: process.env.SWAGGER_PATH ?? 'docs',
  },
  requestLogging: {
    enabled: parseBoolean(process.env.REQUEST_LOGGING_ENABLED, true),
  },
});

/** Mirrors `env.validation.ts`'s Joi boolean coercion for load-factory use. */
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return fallback;
}
