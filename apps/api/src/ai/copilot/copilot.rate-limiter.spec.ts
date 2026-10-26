import { CopilotConfig } from './copilot.config';
import { CopilotRateLimiter } from './copilot.rate-limiter';

function config(requestsPerMinute: number): CopilotConfig {
  return { requestsPerMinute } as unknown as CopilotConfig;
}

describe('CopilotRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows requests under the limit and blocks at the limit', () => {
    const limiter = new CopilotRateLimiter(config(3));

    expect(limiter.check('u1').allowed).toBe(true);
    expect(limiter.check('u1').allowed).toBe(true);
    expect(limiter.check('u1').allowed).toBe(true);
    const blocked = limiter.check('u1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks users independently', () => {
    const limiter = new CopilotRateLimiter(config(1));

    expect(limiter.check('u1').allowed).toBe(true);
    expect(limiter.check('u1').allowed).toBe(false);
    // A different user is unaffected.
    expect(limiter.check('u2').allowed).toBe(true);
  });

  it('frees a slot after the window elapses', () => {
    const limiter = new CopilotRateLimiter(config(1));

    expect(limiter.check('u1').allowed).toBe(true);
    expect(limiter.check('u1').allowed).toBe(false);

    jest.advanceTimersByTime(60_001);
    expect(limiter.check('u1').allowed).toBe(true);
  });

  it('respects the configured limit', () => {
    const limiter = new CopilotRateLimiter(config(5));
    for (let i = 0; i < 5; i += 1) {
      expect(limiter.check('u1').allowed).toBe(true);
    }
    expect(limiter.check('u1').allowed).toBe(false);
  });

  it('can be reset for tests', () => {
    const limiter = new CopilotRateLimiter(config(1));
    expect(limiter.check('u1').allowed).toBe(true);
    limiter.reset();
    expect(limiter.check('u1').allowed).toBe(true);
  });
});
