// Cross-cutting application constants. Kept in one place so the global prefix and metadata keys can never drift…
// between the bootstrap, guards and decorators.
export const API_PREFIX = 'api' as const;
export const API_VERSION = 'v1' as const;
/** Global prefix applied to every route: `/api/v1/...`. */
export const API_GLOBAL_PREFIX = `${API_PREFIX}/${API_VERSION}` as const;

/** Metadata key for `@Public()` — bypasses the authentication guards. */
export const IS_PUBLIC_KEY = 'isPublic' as const;
/** Metadata key for `@Roles(...)` — roles required to access a route. */
export const ROLES_KEY = 'roles' as const;
/** Property on the Express request object holding the authenticated user. */
export const REQUEST_USER_KEY = 'user' as const;
