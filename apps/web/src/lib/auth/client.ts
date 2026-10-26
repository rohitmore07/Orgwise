import { createAuthClient } from '@neondatabase/auth/next';
// Client-side Managed Better Auth instance. In Next.js this proxies through the app's `/api/auth/[...path]`…
// route, so no base URL is needed here.
export const authClient = createAuthClient();
