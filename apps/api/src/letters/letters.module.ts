import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { LettersController } from './letters.controller.js';
import { LettersService } from './letters.service.js';

/**
 * P1 (Core Letter Engine): categories, types, versioned templates, the
 * variable whitelist/renderer, PDF generation, and an immutable
 * generation-time snapshot per letter. No template-editor UI, no
 * employee-profile integration, and no approval workflow yet — see
 * PROJECT_STATUS.md for the phased plan.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [LettersController],
  providers: [LettersService],
})
export class LettersModule {}
