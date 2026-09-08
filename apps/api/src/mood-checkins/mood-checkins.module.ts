import { Module } from '@nestjs/common';
import { MoodCheckInsController } from './mood-checkins.controller.js';
import { MoodCheckInsService } from './mood-checkins.service.js';

@Module({
  controllers: [MoodCheckInsController],
  providers: [MoodCheckInsService],
})
export class MoodCheckInsModule {}
