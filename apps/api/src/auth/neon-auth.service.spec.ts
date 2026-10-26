import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '@app/database/prisma.service';
import { NeonAuthService } from './neon-auth.service';

const BOOTSTRAP_ADMIN = 'admin@orgwise.test';
const NEON_SESSION_COOKIE = '__Secure-neon-auth.session_token';

interface NeonUserRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'viewer';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function row(email: string, role: NeonUserRow['role'], isActive = true): NeonUserRow {
  const now = new Date();
  return {
    id: `id-${email}`,
    email,
    name: email.split('@')[0] ?? email,
    role,
    isActive,
    createdAt: now,
    updatedAt: now,
  };
}

function createConfigMock(adminEmails: string[] = [BOOTSTRAP_ADMIN]) {
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'auth.bootstrapAdminEmails') return adminEmails;
      if (key === 'auth.sessionCacheTtlMs') return 60_000;
      return fallback;
    }),
    getOrThrow: jest.fn(() => 'https://auth.test'),
  };
}

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe('NeonAuthService', () => {
  let prisma: PrismaMock;
  let service: NeonAuthService;
  let fetchMock: jest.Mock;

  const neonSessionUser = (email: string, name: string) => ({
    ok: true,
    json: async () => ({ user: { id: `neon-${email}`, email, name } }),
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new NeonAuthService(
      createConfigMock() as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    fetchMock = jest.fn().mockResolvedValue(neonSessionUser(BOOTSTRAP_ADMIN, 'Admin'));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('validateSession — cookie forwarding', () => {
    it('validates the session by forwarding it as the neon session cookie', async () => {
      prisma.user.findUnique.mockResolvedValue(row(BOOTSTRAP_ADMIN, 'admin'));

      const principal = await service.validateSession('session.cookie.value');

      expect(principal?.email).toBe(BOOTSTRAP_ADMIN);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://auth.test/get-session',
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: `${NEON_SESSION_COOKIE}=session.cookie.value`,
          }),
        }),
      );
    });

    it('rejects an invalid session (upstream returns no user)', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => null });

      await expect(service.validateSession('bogus')).resolves.toBeNull();
    });
  });

  describe('validateSession — bootstrap admin provisioning', () => {
    it('provisions an env-listed email as admin on first contact', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(3); // not the first account
      prisma.user.create.mockResolvedValue(row(BOOTSTRAP_ADMIN, 'admin'));

      const principal = await service.validateSession('cookie-1');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'admin' }) }),
      );
      expect(principal?.roles).toEqual(['admin']);
      expect(principal?.sub).toBe(`id-${BOOTSTRAP_ADMIN}`);
    });

    it('promotes an existing viewer whose email is env-listed to admin + active', async () => {
      prisma.user.findUnique.mockResolvedValue(row(BOOTSTRAP_ADMIN, 'viewer'));
      prisma.user.update.mockResolvedValue(row(BOOTSTRAP_ADMIN, 'admin'));

      const principal = await service.validateSession('cookie-2');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'admin', isActive: true } }),
      );
      expect(principal?.roles).toEqual(['admin']);
    });

    it('re-activates an env-listed but disabled admin', async () => {
      prisma.user.findUnique.mockResolvedValue(row(BOOTSTRAP_ADMIN, 'admin', false));
      prisma.user.update.mockResolvedValue(row(BOOTSTRAP_ADMIN, 'admin'));

      const principal = await service.validateSession('cookie-2b');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'admin', isActive: true } }),
      );
      expect(principal?.roles).toEqual(['admin']);
    });

    it('does not write when an env-listed admin is already admin (no redundant updates)', async () => {
      prisma.user.findUnique.mockResolvedValue(row(BOOTSTRAP_ADMIN, 'admin'));

      await service.validateSession('cookie-3');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('a failed promotion is best-effort and never rejects a valid session', async () => {
      prisma.user.findUnique.mockResolvedValue(row(BOOTSTRAP_ADMIN, 'viewer'));
      prisma.user.update.mockRejectedValue(new Error('db hiccup'));

      const principal = await service.validateSession('cookie-4');

      // Session still resolves (as the existing viewer) — just not promoted.
      expect(principal).not.toBeNull();
      expect(principal?.roles).toEqual(['viewer']);
    });

    it('provisions the first-ever account as admin even when unlisted', async () => {
      fetchMock.mockResolvedValue(neonSessionUser('unlisted@example.com', 'U'));
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      prisma.user.create.mockResolvedValue(row('unlisted@example.com', 'admin'));

      const principal = await service.validateSession('cookie-5');

      expect(principal?.roles).toEqual(['admin']);
    });

    it('leaves unlisted non-first accounts as viewer', async () => {
      fetchMock.mockResolvedValue(neonSessionUser('viewer@example.com', 'V'));
      prisma.user.findUnique.mockResolvedValue(row('viewer@example.com', 'viewer'));

      const principal = await service.validateSession('cookie-6');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(principal?.roles).toEqual(['viewer']);
    });
  });
});
