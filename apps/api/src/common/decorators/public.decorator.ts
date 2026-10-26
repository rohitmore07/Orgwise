import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/app.constants';
// Marks a route (or an entire controller) as publicly accessible, bypassing the session authentication guard.…
// @example @Public() @Post('sign-in') signIn() { ... }
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
