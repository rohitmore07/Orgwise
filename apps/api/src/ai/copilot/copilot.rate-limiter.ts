import { Injectable } from '@nestjs/common';
import { CopilotConfig } from './copilot.config';

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the window frees a slot (for Retry-After). */
  retryAfterSeconds: number;
}
// Per-user sliding-window rate limiter for copilot requests. In-memory by design: single-instance deployment…
// keeps state in the process. A multi-instance deployment would swap this for a shared store (Redis) without…
@Injectable()
export class CopilotRateLimiter {
  /** userId → timestamps of accepted requests in the current window. */
  private readonly windows = new Map<string, number[]>();

  constructor(private readonly config: CopilotConfig) {}

  check(userId: string): RateLimitDecision {
    const limit = this.config.requestsPerMinute;
    const windowMs = 60_000;
    const now = Date.now();

    const recent = (this.windows.get(userId) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
      this.windows.set(userId, recent);
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      };
    }

    recent.push(now);
    this.windows.set(userId, recent);
    // Bound memory: drop windows that have been idle long enough to forget.
    if (this.windows.size > 1000) {
      const cutoff = now - windowMs;
      for (const [key, stamps] of this.windows) {
        if (stamps.every((t) => now - t > cutoff)) this.windows.delete(key);
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Test-only: reset all windows. */
  reset(): void {
    this.windows.clear();
  }
}
