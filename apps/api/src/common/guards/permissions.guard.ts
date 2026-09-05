import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';

/**
 * Reads the permission set `JwtAuthGuard` attached to `request.authContext`
 * — always runs after it in `AppModule`'s global guard order. A route with
 * no `@RequirePermissions()` metadata passes through unchecked (still
 * subject to `JwtAuthGuard` unless also `@Public()`).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const granted = request.authContext?.permissions ?? [];
    const hasAll = required.every((permission) => granted.includes(permission));
    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}
