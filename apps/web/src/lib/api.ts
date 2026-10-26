import type {
  ApiErrorResponse,
  ApiResponse,
  HealthStatus,
  LiveSignalsSnapshot,
} from '@orgwise/types';
import { getStoredSession, syncOAuthSession } from '@/lib/auth';
// Browser-facing API client. Every request carries the Neon Auth session token as `Authorization: Bearer…
// <token>`; the API validates it against the Neon Auth server and resolves the caller's RBAC role from the…

// Resolve the API base URL, always pointing at the `/api/v1` prefix. A bare host is a common
// misconfiguration that 404s every request, so normalize it instead of failing silently.
function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl();
const API_URL = API_BASE_URL;
const REQUEST_TIMEOUT_MS = 15000;

// ── GET response cache ─────────────────────────────────────────────────────
// Short-lived, per-user cache: dedupes concurrent requests for the same URL
// and avoids refetching reference data (departments, teams, filter options)
// on every page mount. Successful writes purge the cache so post-mutation
// refetches are always fresh. Never caches failures.
const CACHE_TTL_MS = 30_000;
const getCache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

/** Drop every cached GET — call before a forced refresh or after sign-out. */
export function purgeApiCache(): void {
  getCache.clear();
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Do not attach the auth header (public endpoints only). */
  noAuth?: boolean;
  /** Skip the 401-refresh-and-retry cycle (used by the refresh itself). */
  skipRetry?: boolean;
  /** Bypass the GET cache entirely (volatile endpoints, e.g. live polling). */
  noCache?: boolean;
  /** Override the GET cache TTL in ms (default 30s). */
  cacheTtlMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, noAuth, skipRetry, noCache, cacheTtlMs, headers, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const isGet = method === 'GET';
  // Keyed per signed-in user so role-scoped responses can never be served to a
  // different account within the same page session.
  const cacheKey = `${method} ${API_URL}${path} | ${getStoredSession()?.user.id ?? 'anon'}`;

  if (isGet && !noCache) {
    const entry = getCache.get(cacheKey);
    if (entry && entry.expiresAt > Date.now()) return entry.promise as Promise<T>;
  }

  const execute = async (): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const authHeader = !noAuth ? getAuthHeader() : undefined;
    const isFormData = body instanceof FormData;

    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...rest,
        signal: controller.signal,
        // Include same-site cookies so the `__Secure-neon-auth.*` session cookie (HttpOnly — invisible to JS) travels…
        // with the request; the API validates sessions via that cookie.
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...headers,
        },
        ...(body !== undefined && !isFormData ? { body: JSON.stringify(body) } : {}),
        ...(body !== undefined && isFormData ? { body } : {}),
      });

      if (response.status === 401 && !skipRetry && !noAuth) {
        await syncOAuthSession();
        if (getStoredSession()) {
          // Bypass the cache on the retry so a stale entry cannot mask a re-auth.
          return request<T>(path, { ...options, skipRetry: true, noCache: true });
        }
      }

      if (!response.ok) {
        throw await toError(response);
      }

      const payload = (await response.json()) as ApiResponse<T>;
      // Any successful write invalidates cached reads.
      if (!isGet) purgeApiCache();
      return payload.data;
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiClientError('Request timed out — please try again', 408);
      }
      throw new ApiClientError('Could not reach the orgwise API. Is the API running?', 0, error);
    } finally {
      clearTimeout(timeout);
    }
  };

  if (isGet && !noCache) {
    // A failed request is never cached — drop the entry so a transient error
    // does not poison the cache for the rest of the TTL window.
    const promise = execute().catch((error) => {
      getCache.delete(cacheKey);
      throw error;
    });
    getCache.set(cacheKey, {
      promise,
      expiresAt: Date.now() + (cacheTtlMs ?? CACHE_TTL_MS),
    });
    return promise;
  }
  return execute();
}

function getAuthHeader(): string | undefined {
  const session = getStoredSession();
  return session?.token ? `Bearer ${session.token}` : undefined;
}

async function toError(response: Response): Promise<ApiClientError> {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return new ApiClientError(
      payload.message || `Request failed (${response.status})`,
      response.status,
      payload.details,
    );
  } catch {
    return new ApiClientError(`Request failed (${response.status})`, response.status);
  }
}

// ── typed helpers ────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

// ── public (unauthenticated) helpers for the marketing site ──────────────────

/** `GET /api/v1/health` — process health + uptime (public). */
export function fetchHealth(): Promise<HealthStatus | null> {
  return request<HealthStatus>('/health', { noAuth: true }).catch(() => null);
}

/** `GET /api/v1/signals/live` — live workforce signal snapshot (public). */
export function fetchLiveSignals(): Promise<LiveSignalsSnapshot | null> {
  // Short TTL: still dedupes concurrent landing-page fetches, but never shows
  // the ticking counters more than ~5s stale.
  return request<LiveSignalsSnapshot>('/signals/live', { noAuth: true, cacheTtlMs: 5000 }).catch(
    () => null,
  );
}

// ── authenticated downloads (e.g. CSV template) ──────────────────────────────

// Fetches an auth-protected endpoint as a Blob and triggers a browser download. Plain `<a href download>`…
// cannot attach the bearer token, so any protected file must go through this helper.
export async function downloadAuthenticated(path: string, filename: string): Promise<void> {
  const authHeader = getAuthHeader();
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'text/csv, application/octet-stream',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });
  if (!response.ok) throw await toError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Fetches an auth-protected CSV sample from the API and returns it as a File object. */
export async function fetchSampleCsv(path = '/imports/sample'): Promise<File> {
  const authHeader = getAuthHeader();
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'text/csv, application/octet-stream',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });
  if (!response.ok) throw await toError(response);
  const blob = await response.blob();
  return new File([blob], 'sample.csv', { type: 'text/csv' });
}
