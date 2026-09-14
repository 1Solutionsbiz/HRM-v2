import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Gates the external-cron trigger routes (see each module's
 * `POST .../cron/...` endpoint) — these run `@Public()` since there's no
 * logged-in user, so this is the only thing standing between them and the
 * open internet. Checked against a single shared secret (CRON_SECRET) sent
 * as `Authorization: Bearer <secret>` by the external scheduler (cron-job.org),
 * the same convention already used by the sister CRM app's own cron routes.
 *
 * In-process @Cron scheduling (@nestjs/schedule) turned out to be
 * unreliable here - see the comments on each service's cron handler - most
 * likely because Hostinger's Node hosting doesn't keep the process alive
 * between requests, so an in-process timer can silently never fire. An
 * external scheduler hitting these routes on a real HTTP request forces the
 * process to actually wake up and run the job.
 */
@Injectable()
export class CronAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get<string>('CRON_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('CRON_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (header !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }
    return true;
  }
}
