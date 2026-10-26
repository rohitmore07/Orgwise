import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { ApiResponse } from '@orgwise/types';
import { type Observable, map } from 'rxjs';

const SUCCESS_MESSAGE = 'OK';
// Global response interceptor. Wraps every successful HTTP response in the standard envelope: `{ success,…
// message, data, timestamp }`. Streaming responses and payloads that are already enveloped pass through…
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | StreamableFile | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | StreamableFile | T> {
    if (context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      map((data: T) => {
        if (data instanceof StreamableFile) return data;
        if (isApiResponse(data)) return data;

        return {
          success: true,
          message: SUCCESS_MESSAGE,
          data,
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<T>;
      }),
    );
  }
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'data' in value &&
    'timestamp' in value
  );
}
