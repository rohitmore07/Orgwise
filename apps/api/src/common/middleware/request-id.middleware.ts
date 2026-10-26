import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
// Request-id / correlation-id middleware. Assigns a `X-Request-Id` header to every request — honoring an…
// upstream id (from a gateway) when present, otherwise generating a UUID. The id is attached to `request.id` so…
export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  };
}
