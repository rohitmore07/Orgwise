import type { Role } from '../enums/role.enum';
// Authenticated principal attached to `request.user` by the JWT strategy. This is the shape consumed by…
// `@CurrentUser()` and the `RolesGuard` — keep it minimal and stable; never place sensitive claims here.
export interface RequestUser {
  /** Subject — the user's stable identifier. */
  sub: string;
  email: string;
  roles: Role[];
}
