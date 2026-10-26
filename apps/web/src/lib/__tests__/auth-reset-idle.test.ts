import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Better Auth client so the facade is tested in isolation.
const authClientMock = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock('@/lib/auth/client', () => ({ authClient: authClientMock }));

import { requestPasswordReset, resetPasswordWithToken } from '@/lib/auth';

describe('password reset facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok on a successful reset request', async () => {
    authClientMock.requestPasswordReset.mockResolvedValue({ data: {}, error: null });

    const res = await requestPasswordReset('leader@company.com');

    expect(res).toEqual({ ok: true });
    expect(authClientMock.requestPasswordReset).toHaveBeenCalledWith({
      email: 'leader@company.com',
    });
  });

  it('surfaces a friendly error when the auth service rejects', async () => {
    authClientMock.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests' },
    });

    const res = await requestPasswordReset('leader@company.com');

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Too many requests');
  });

  it('handles a network failure without throwing', async () => {
    authClientMock.requestPasswordReset.mockRejectedValue(new Error('offline'));

    const res = await requestPasswordReset('leader@company.com');

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Could not reach the authentication service');
  });

  it('completes the reset with token + new password', async () => {
    authClientMock.resetPassword.mockResolvedValue({ data: { status: true }, error: null });

    const res = await resetPasswordWithToken('new-password-123', 'token-abc');

    expect(res).toEqual({ ok: true });
    expect(authClientMock.resetPassword).toHaveBeenCalledWith({
      newPassword: 'new-password-123',
      token: 'token-abc',
    });
  });

  it('rejects a missing token without calling the API', async () => {
    const res = await resetPasswordWithToken('new-password-123', null);

    expect(res.ok).toBe(false);
    expect(res.error).toContain('invalid or expired');
    expect(authClientMock.resetPassword).not.toHaveBeenCalled();
  });
});
