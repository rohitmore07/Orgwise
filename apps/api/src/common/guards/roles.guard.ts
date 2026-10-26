import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
// Value import, not `type`: Reflector is a Nest-provided DI token resolved
// from emitted decorator metadata (`design:paramtypes`).
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../constants/app.constants';
import type { Role } from '../enums/role.enum';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
// Role-based authorization guard. Reads the roles required by `@Roles(...)` (or a controller-level decorator)…
// and checks them against the authenticated user's roles. Public routes and routes without `@Roles(...)` are…
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.roles?.length) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const authorized = requiredRoles.some((role) => user.roles?.includes(role));
    if (!authorized) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
