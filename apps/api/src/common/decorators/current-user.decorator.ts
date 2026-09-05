import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from '../auth-context.js';

/** Reads the `AuthContext` `JwtAuthGuard` attached to the request. Only valid on non-`@Public()` routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.authContext) {
      throw new UnauthorizedException('No authenticated context on request');
    }
    return request.authContext;
  },
);
