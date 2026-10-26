import { auth } from '@/lib/auth/server';
// Catch-all proxy for Managed Better Auth. Handles sign-in/sign-up requests, OAuth callbacks, session…
// management, and sign-out — all routed to the Neon Auth server.
export const { GET, POST } = auth.handler();
