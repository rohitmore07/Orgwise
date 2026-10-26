import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/app.constants';
import type { Role } from '../enums/role.enum';
// Restricts a route (or controller) to one or more roles. Combine with the `RolesGuard`. @example…
// @Roles(Role.ADMIN) @Get('audit') audit() { ... }
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
