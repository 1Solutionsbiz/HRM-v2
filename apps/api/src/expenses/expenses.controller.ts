import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { ExpensesService } from './expenses.service.js';
import { SubmitExpenseClaimDto } from './dto/submit-expense-claim.dto.js';
import { DecideExpenseClaimDto } from './dto/decide-expense-claim.dto.js';
import { receiptMulterOptions } from './receipt-upload.config.js';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('categories')
  getCategories() {
    return this.expensesService.getCategories();
  }

  @Post('receipts')
  @UseInterceptors(FileInterceptor('file', receiptMulterOptions))
  uploadReceipt(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ): { url: string } {
    if (!file) throw new BadRequestException('No file was uploaded.');
    // Absolute, not relative: the web app calls this API from a different
    // origin (hrm.1solutions.biz vs hrm-api.1solutions.biz), so a relative
    // path would resolve against the wrong host if stored as-is.
    const url = `${request.protocol}://${request.get('host')}/uploads/receipts/${file.filename}`;
    return { url };
  }

  @Get('claims')
  getMyClaims(@CurrentUser() actor: AuthContext) {
    return this.expensesService.getMyClaims(actor.userId);
  }

  @Post('claims')
  submitClaim(
    @Body() dto: SubmitExpenseClaimDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.expensesService.submitClaim(actor.userId, dto, actor);
  }

  @Patch('claims/:id/cancel')
  cancelMyClaim(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.expensesService.cancelMyClaim(actor.userId, id, actor);
  }

  @Get('claims/company')
  @RequirePermissions('expense:approve')
  getCompanyClaims() {
    return this.expensesService.getCompanyClaims();
  }

  @Patch('claims/:id/decide')
  @RequirePermissions('expense:approve')
  decide(
    @Param('id') id: string,
    @Body() dto: DecideExpenseClaimDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.expensesService.decide(id, dto, actor);
  }
}
