import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './exceptions/global-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
// Registers the platform-wide cross-cutting infrastructure: - `GlobalExceptionFilter` → standard `{success,…
// message, data, timestamp}` error envelope - `ResponseInterceptor` → standard success envelope Per-request…
@Module({
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class CommonModule {}
