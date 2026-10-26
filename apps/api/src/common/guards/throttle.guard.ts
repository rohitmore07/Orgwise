import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { REQUEST_USER_KEY } from '../constants/app.constants';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
// Global rate limiter with user-aware tracking. Default `ThrottlerGuard` buckets by client IP, which breaks…
// down behind a reverse proxy (every request looks like the proxy) and under shared NAT (a whole office…
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const principal = (req as unknown as AuthenticatedRequest)[REQUEST_USER_KEY];
    if (principal?.sub) return `user:${principal.sub}`;
    const ip = (req as { ip?: string }).ip;
    return `ip:${ip ?? 'unknown'}`;
  }
}
