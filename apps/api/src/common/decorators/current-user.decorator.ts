import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { REQUEST_USER_KEY } from '../constants/app.constants';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import type { RequestUser } from '../interfaces/request-user.interface';
// Injects the authenticated user — or a single field of it — into a handler. @example @Get('me')…
// getMe(@CurrentUser() user: RequestUser) { ... } @Get('me/email') getEmail(@CurrentUser('email') email:…
export const CurrentUser = createParamDecorator(
  (
    field: keyof RequestUser | undefined,
    context: ExecutionContext,
  ): RequestUser | RequestUser[keyof RequestUser] => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request[REQUEST_USER_KEY];

    if (!user) {
      throw new UnauthorizedException('No authenticated user on this request');
    }

    return field ? user[field] : user;
  },
);
