import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The auth facade drags in the Neon SDK — stub it so the client under test is
// isolated (anonymous sessions only, no re-auth path).
vi.mock('@/lib/auth', () => ({
  getStoredSession: () => null,
  syncOAuthSession: vi.fn(),
}));

import { api, purgeApiCache } from '@/lib/api';

const okEnvelope = {
  success: true,
  message: 'OK',
  data: { value: 1 },
  timestamp: new Date().toISOString(),
};

function mockFetch(status = 200, body: unknown = okEnvelope): ReturnType<typeof vi.fn> {
  // A fresh Response per call — a Response body can only be consumed once.
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('api client GET cache', () => {
  beforeEach(() => {
    purgeApiCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    purgeApiCache();
  });

  it('dedupes concurrent identical GET requests into a single network call', async () => {
    const fetchMock = mockFetch();

    const [a, b] = await Promise.all([api.get('/departments'), api.get('/departments')]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ value: 1 });
    expect(b).toEqual({ value: 1 });
  });

  it('serves repeated reads from the cache within the TTL', async () => {
    const fetchMock = mockFetch();

    await api.get('/teams');
    await api.get('/teams');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('purges the cache after a successful write so refetches are fresh', async () => {
    const fetchMock = mockFetch();

    await api.get('/departments');
    await api.post('/departments', { name: 'X' });
    await api.get('/departments');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('bypasses the cache when noCache is set', async () => {
    const fetchMock = mockFetch();

    await api.get('/teams', { noCache: true });
    await api.get('/teams', { noCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never caches a failed request (transient errors cannot poison the cache)', async () => {
    const fetchMock = mockFetch(500, {
      success: false,
      message: 'boom',
      data: null,
      statusCode: 500,
      error: 'Internal Server Error',
      path: '/teams',
      timestamp: new Date().toISOString(),
    });

    await expect(api.get('/teams')).rejects.toThrow('boom');
    await expect(api.get('/teams')).rejects.toThrow('boom');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats an expired entry as a cache miss', async () => {
    const fetchMock = mockFetch();

    await api.get('/teams', { cacheTtlMs: -1 });
    await api.get('/teams', { cacheTtlMs: -1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
