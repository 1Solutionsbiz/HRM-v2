import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

/**
 * Global: forgot-password is the first consumer, but outbound mail
 * (approval notifications, digests, etc.) is infrastructure any module may
 * eventually need — same reasoning as SecurityModule.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
