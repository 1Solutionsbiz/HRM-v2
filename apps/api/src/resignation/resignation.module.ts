import { Module } from '@nestjs/common';
import { ResignationController } from './resignation.controller.js';
import { ResignationService } from './resignation.service.js';

@Module({
  controllers: [ResignationController],
  providers: [ResignationService],
})
export class ResignationModule {}
