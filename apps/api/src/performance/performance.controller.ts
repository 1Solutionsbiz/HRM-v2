import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { PerformanceService } from './performance.service.js';
import { UpdateGoalProgressDto } from './dto/update-goal-progress.dto.js';
import { CreateGoalDto } from './dto/create-goal.dto.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { CreateRecognitionDto } from './dto/create-recognition.dto.js';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('cycles')
  getCycles() {
    return this.performanceService.getCycles();
  }

  @Get('me')
  getMyPerformance(@CurrentUser() actor: AuthContext) {
    return this.performanceService.getMyPerformance(actor.userId);
  }

  @Patch('goals/:id/progress')
  updateMyGoalProgress(
    @Param('id') id: string,
    @Body() dto: UpdateGoalProgressDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.performanceService.updateMyGoalProgress(actor.userId, id, dto);
  }

  @Get('employees/:employeeId')
  @RequirePermissions('performance:manage')
  getEmployeePerformance(@Param('employeeId') employeeId: string) {
    return this.performanceService.getEmployeePerformance(employeeId);
  }

  @Post('employees/:employeeId/goals')
  @RequirePermissions('performance:manage')
  createGoal(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateGoalDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.performanceService.createGoal(employeeId, dto, actor);
  }

  @Post('employees/:employeeId/reviews')
  @RequirePermissions('performance:manage')
  createReview(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.performanceService.createReview(employeeId, dto, actor);
  }

  @Post('employees/:employeeId/recognitions')
  @RequirePermissions('performance:manage')
  createRecognition(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateRecognitionDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.performanceService.createRecognition(employeeId, dto, actor);
  }
}
