import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { PrismaService } from '@app/database/prisma.service';
import type { Role } from '@app/common/enums/role.enum';

/** Session cache entry: the principal we attach to the request. */
interface CachedPrincipal {
  sub: string;
  email: string;
  roles: Role[];
  expiresAt: number;
}

/** Identity returned by the Neon Auth `get-session` endpoint. */
interface NeonSessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}
// Bridges Neon Auth (Managed Better Auth) sessions into orgwise RBAC. The web app owns sign-in/sign-up via…
// Neon Auth; the browser then holds the `__Secure-neon-auth.session_token` cookie. Neon's managed server only…
@Injectable()
export class NeonAuthService {
  private readonly logger = new Logger(NeonAuthService.name);
  private readonly cache = new Map<string, CachedPrincipal>();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.cacheTtlMs = this.config.get<number>('auth.sessionCacheTtlMs', 60_000);
  }
  // Validates a Neon session and returns the principal to attach to `request.user`, or `null` when the session is…
  // missing/invalid/expired. @param sessionToken the `__Secure-neon-auth.session_token` cookie value, forwarded…
  async validateSession(sessionToken: string): Promise<CachedPrincipal | null> {
    const cached = this.cache.get(sessionToken);
    if (cached && cached.expiresAt > Date.now()) return cached;

    try {
      const user = await this.fetchSessionUser(sessionToken);
      if (!user) return null;

      const localUser = await this.syncLocalUser(user);
      if (!localUser?.isActive) return null;

      const principal: CachedPrincipal = {
        sub: localUser.id,
        email: localUser.email,
        roles: [localUser.role as Role],
        expiresAt: Date.now() + this.cacheTtlMs,
      };
      this.cache.set(sessionToken, principal);
      return principal;
    } catch (error) {
      this.logger.warn(
        `Neon session validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Calls the managed auth server to confirm the session cookie. */
  private async fetchSessionUser(sessionToken: string): Promise<NeonSessionUser | null> {
    const baseUrl = this.config.getOrThrow<string>('auth.neonBaseUrl');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${baseUrl}/get-session`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          // The managed server validates sessions ONLY via the signed
          // session_token cookie — mirroring the SDK's proxy behavior.
          Cookie: `__Secure-neon-auth.session_token=${sessionToken}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) return null;
      const payload = (await response.json()) as {
        session?: unknown;
        user?: NeonSessionUser | null;
      } | null;

      // The auth server returns `null` when the token is invalid/expired.
      if (!payload?.user) return null;
      return payload.user;
    } catch (error) {
      this.logger.warn(
        `Neon Auth unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** True when the email is listed in the `ADMIN_EMAILS` env var (case-insensitive). */
  private isBootstrapAdmin(email: string): boolean {
    return this.config.get<string[]>('auth.bootstrapAdminEmails', []).includes(email.toLowerCase());
  }

  /** Finds (or provisions) the local User for the confirmed Neon identity. */
  private async syncLocalUser(neonUser: NeonSessionUser): Promise<User | null> {
    let user = await this.prisma.user.findUnique({ where: { email: neonUser.email } });
    const bootstrapAdmin = this.isBootstrapAdmin(neonUser.email);

    if (!user) {
      const isFirstAccount = (await this.prisma.user.count()) === 0;
      try {
        user = await this.prisma.user.create({
          data: {
            email: neonUser.email,
            name: neonUser.name?.trim() || neonUser.email.split('@')[0] || 'User',
            // First account boots as admin so a fresh deployment is usable;
            // env-configured bootstrap admins start with full access too.
            role: isFirstAccount || bootstrapAdmin ? 'admin' : 'viewer',
          },
        });
        this.logger.log(
          `Provisioned local user ${user.email} with role ${user.role}${isFirstAccount ? ' (first account → admin)' : ''}`,
        );
      } catch (error) {
        // Unique-email race: another request provisioned it first.
        if (this.isUniqueViolation(error)) {
          user = await this.prisma.user.findUnique({ where: { email: neonUser.email } });
        } else {
          throw error;
        }
      }
    } else if (bootstrapAdmin && (user.role !== 'admin' || !user.isActive)) {
      // Env-listed admins are re-promoted on every session even if they were provisioned earlier as viewers (e.g.…
      // before ADMIN_EMAILS was set) and can never be locked out by an isActive flag. NOTE: this also means a UI…
      try {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { role: 'admin', isActive: true },
        });
        this.logger.log(`Promoted bootstrap admin ${user.email} to admin`);
      } catch (error) {
        // Best-effort: a failed promotion must never reject a valid session —
        // keep the previously fetched user and continue.
        this.logger.warn(
          `Bootstrap admin promotion failed for ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return user;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
