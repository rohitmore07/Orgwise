import type { Request } from 'express';
import type { RequestUser } from './request-user.interface';
// Express request that has passed through the JWT authentication guard. `user` is populated by the Passport…
// strategy; use this type in controllers and guards instead of a raw `Request` for full type-safety.
export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
}
