import { type NextRequest, NextResponse } from 'next/server';
// Server-side route guards. - **Home** (`/`): the landing page is the marketing site for visitors; signed-in…
// users are sent straight into the workspace so a fresh login never strands them on the public site. - **App…
const SESSION_COOKIE_KEY = 'orgwise_session';
// Query param Neon Auth appends to the callback URL after OAuth sign-in. Matches…
// `NEON_AUTH_SESSION_VERIFIER_PARAM_NAME` in @neondatabase/auth — if the SDK ever renames it, update both sides…
const SESSION_VERIFIER_PARAM = 'neon_auth_session_verifier';

const APP_ROUTES = [
  '/dashboard',
  '/employees',
  '/departments',
  '/teams',
  '/imports',
  '/users',
  '/audit-logs',
  '/organization',
];
// Dynamic app routes protected the same way as the static ones (e.g. a deep link to an employee profile must…
// not render an error state for a signed-out visitor — it should redirect to /signin like every other page).
const APP_ROUTE_PATTERNS = ['/employees/:path*'];
const ADMIN_ONLY_ROUTES = ['/users', '/audit-logs'];
const AUTH_PAGES = ['/signin', '/signup'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_KEY)?.value;

  if (pathname === '/') {
    // Signed-in visitors get the workspace, not the marketing site. (The marker cookie is only set by client-side…
    // JS, so a fresh OAuth callback lands here before it exists — the landing page's session-sync then completes…
    if (sessionCookie && !isExpired(sessionCookie)) {
      // Preserve a fresh OAuth session verifier even when an old marker cookie is still valid (e.g. switching…
      // accounts) so the new session is actually consumed by the workspace's AuthProvider.
      const url = new URL('/dashboard', request.url);
      const verifier = request.nextUrl.searchParams.get(SESSION_VERIFIER_PARAM);
      if (verifier) url.searchParams.set(SESSION_VERIFIER_PARAM, verifier);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (AUTH_PAGES.includes(pathname)) {
    if (sessionCookie && !isExpired(sessionCookie)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (APP_ROUTES.includes(pathname) || APP_ROUTE_PATTERNS.some((p) => pathMatch(p, pathname))) {
    const hasSessionVerifier = request.nextUrl.searchParams.has(SESSION_VERIFIER_PARAM);
    if (!sessionCookie || isExpired(sessionCookie)) {
      // A fresh OAuth callback carries the session verifier — let the client complete the handshake (AuthProvider ->…
      // getSession) instead of bouncing, and never drop the verifier on a /signin redirect.
      if (hasSessionVerifier) return NextResponse.next();
      const url = new URL('/signin', request.url);
      url.searchParams.set('next', pathname);
      const verifier = request.nextUrl.searchParams.get(SESSION_VERIFIER_PARAM);
      if (verifier) url.searchParams.set(SESSION_VERIFIER_PARAM, verifier);
      return NextResponse.redirect(url);
    }
    // Note: the verifier pass-through above skips the admin-only check — the role is resolved client-side after the…
    // handshake. That's fine: this middleware is a UX guard, not a security boundary (the API enforces real RBAC),…
    if (ADMIN_ONLY_ROUTES.includes(pathname) && !hasRole(sessionCookie, 'admin')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

/** Minimal `:path*` matcher for the dynamic app-route patterns above. */
function pathMatch(pattern: string, pathname: string): boolean {
  const prefix = pattern.replace('/:path*', '');
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function hasRole(cookieValue: string, role: string): boolean {
  try {
    const session = JSON.parse(cookieValue) as { role?: string };
    return session.role === role;
  } catch {
    return false;
  }
}

function isExpired(cookieValue: string): boolean {
  try {
    const session = JSON.parse(cookieValue) as { expiresAt?: string };
    // No expiry claim → treat as valid. An invalid date must count as expired
    // (NaN comparisons are always false and would wrongly redirect).
    if (!session.expiresAt) return false;
    const expiresAt = new Date(session.expiresAt).getTime();
    return Number.isNaN(expiresAt) || expiresAt <= Date.now();
  } catch {
    // Malformed cookie — treat as signed out so the auth page stays reachable.
    return true;
  }
}

export const config = {
  matcher: [
    '/',
    '/signin',
    '/signup',
    '/dashboard',
    '/employees',
    '/employees/:path*',
    '/departments',
    '/teams',
    '/imports',
    '/users',
    '/audit-logs',
    '/organization',
  ],
};
