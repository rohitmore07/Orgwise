import { type NextRequest, NextResponse } from 'next/server';

// Better Auth prefixes the session cookie with `__Secure-` when served over
// HTTPS; on plain http://localhost it uses the unprefixed name.
const COOKIE_NAMES = ['__Secure-neon-auth.session_token', 'neon-auth.session_token'];

/**
 * Returns the full signed session token held in the HttpOnly cookie. The
 * cross-origin API cannot receive that cookie, and the Better Auth SDK only
 * exposes the unsigned session id — so the client reads the real token back
 * through this same-origin route and sends it as `Authorization: Bearer`.
 */
export function GET(request: NextRequest) {
  for (const name of COOKIE_NAMES) {
    const token = request.cookies.get(name)?.value;
    if (token) return NextResponse.json({ token });
  }
  return NextResponse.json({ token: null });
}
