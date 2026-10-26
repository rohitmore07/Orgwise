import { createNeonAuth } from '@neondatabase/auth/next/server';
// Server-side Managed Better Auth instance. Required env vars (from the Neon Console → Branch → Auth →…
// Configuration): - NEON_AUTH_BASE_URL the `neonauth.*.neon.build` base URL for this branch -…
const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl || !cookieSecret) {
  console.warn(
    '[neon-auth] NEON_AUTH_BASE_URL / NEON_AUTH_COOKIE_SECRET are not set. ' +
      'Auth endpoints will be unavailable until configured (see .env.example).',
  );
}
// Fallback secret used ONLY so the app boots before env is configured. It is generated fresh per process (never…
// a known constant), so it cannot be used to forge sessions — sessions simply do not survive restarts until…
const fallbackSecret =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}`
    : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

export const auth = createNeonAuth({
  baseUrl: baseUrl ?? 'https://missing-neon-auth-base-url.invalid/neondb/auth',
  cookies: {
    secret: cookieSecret ?? fallbackSecret,
  },
});
