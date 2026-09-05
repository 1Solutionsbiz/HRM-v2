import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { AttendanceService } from './attendance.service.js';
import { GetHistoryQueryDto } from './dto/get-history-query.dto.js';
import { RecordCorrectionDto } from './dto/record-correction.dto.js';

function requestMeta(request: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return { ipAddress: request.ip, userAgent: request.headers['user-agent'] };
}

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@CurrentUser() actor: AuthContext, @Req() request: Request) {
    return this.attendanceService.checkIn(actor, requestMeta(request));
  }

  @Post('check-out')
  checkOut(@CurrentUser() actor: AuthContext, @Req() request: Request) {
    return this.attendanceService.checkOut(actor, requestMeta(request));
  }

  @Get('today')
  getToday(@CurrentUser() actor: AuthContext) {
    return this.attendanceService.getTodayForUser(actor.userId);
  }

  @Get('history')
  getHistory(
    @CurrentUser() actor: AuthContext,
    @Query() query: GetHistoryQueryDto,
  ) {
    return this.attendanceService.getHistoryForUser(actor.userId, query);
  }

  @Get('policy')
  getPolicy() {
    return this.attendanceService.getPolicyOrThrow();
  }

  /** HR/admin manual correction — see AttendanceService.recordCorrection for the semantics. */
  @Post('employees/:employeeId/corrections')
  @RequirePermissions('attendance:manage')
  recordCorrection(
    @Param('employeeId') employeeId: string,
    @Body() dto: RecordCorrectionDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.attendanceService.recordCorrection(employeeId, dto, actor);
  }
}
