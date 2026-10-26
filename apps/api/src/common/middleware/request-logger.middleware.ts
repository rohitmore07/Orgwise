import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('RequestLogger');
// Express-level request logger: one line per request with method, route, status code and duration. Disabled via…
// `REQUEST_LOGGING_ENABLED=false`. Complements the per-handler `LoggingInterceptor`: this middleware observes…
export function requestLoggerMiddleware(config: ConfigService) {
  const enabled = config.get<boolean>('requestLogging.enabled', true);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enabled) {
      next();
      return;
    }

    const startedAt = Date.now();
    res.on('finish', () => {
      // `req.id` is assigned by the request-id middleware (registered first)
      // so every log line can be correlated with the client's X-Request-Id.
      logger.log(
        `[${req.id ?? '-'}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - startedAt}ms)`,
      );
    });
    next();
  };
}
