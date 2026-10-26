import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
// Value import, not `type`: Reflector is a Nest-provided DI token resolved
// from emitted decorator metadata (`design:paramtypes`).
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { NeonAuthService } from '@app/auth/neon-auth.service';
import { IS_PUBLIC_KEY, REQUEST_USER_KEY } from '../constants/app.constants';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import type { RequestUser } from '../interfaces/request-user.interface';

/** The Neon Auth session cookie this app's web client carries. */
const NEON_SESSION_COOKIE = '__Secure-neon-auth.session_token';
// Global authentication guard. Neon's managed server validates sessions ONLY via the signed…
// `__Secure-neon-auth.session_token` cookie (Bearer tokens are not honored), so the guard reads that cookie…
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    protected readonly reflector: Reflector,
    private readonly neonAuth: NeonAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionValue = this.extractNeonSessionCookie(request) ?? this.extractBearerToken(request);
    if (!sessionValue) {
      throw new UnauthorizedException('Missing authentication session');
    }

    const principal = await this.neonAuth.validateSession(sessionValue);
    if (!principal) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request[REQUEST_USER_KEY] = principal as RequestUser;
    return true;
  }

  /** Reads the Neon session cookie value from the request (browser clients). */
  private extractNeonSessionCookie(request: Request): string | null {
    const header = request.headers.cookie;
    if (!header) return null;
    const match = header.match(new RegExp(`(?:^|;\\s*)${NEON_SESSION_COOKIE}=([^;]+)`));
    return match?.[1] ?? null;
  }

  /** Reads a session value from the Authorization header (API clients). */
  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
