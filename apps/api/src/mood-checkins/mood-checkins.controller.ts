import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { MoodCheckInsService } from './mood-checkins.service.js';
import { SubmitMoodCheckInDto } from './dto/submit-mood-checkin.dto.js';

@Controller('mood-checkins')
export class MoodCheckInsController {
  constructor(private readonly moodCheckInsService: MoodCheckInsService) {}

  @Get('status')
  getStatus(@CurrentUser() actor: AuthContext) {
    return this.moodCheckInsService.getStatus(actor.userId);
  }

  @Post()
  submit(
    @Body() dto: SubmitMoodCheckInDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.moodCheckInsService.submit(actor.userId, dto);
  }

  @Post('dismiss')
  dismiss(@CurrentUser() actor: AuthContext) {
    return this.moodCheckInsService.dismiss(actor.userId);
  }

  @Get('mine')
  getMine(@CurrentUser() actor: AuthContext) {
    return this.moodCheckInsService.getMine(actor.userId);
  }
}
