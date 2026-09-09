import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { readFile } from 'node:fs/promises';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { ExpensesService } from './expenses.service.js';
import { SubmitExpenseClaimDto } from './dto/submit-expense-claim.dto.js';
import { DecideExpenseClaimDto } from './dto/decide-expense-claim.dto.js';
import { receiptFilePath, receiptMulterOptions } from './receipt-upload.config.js';

// Matches exactly what receipt-upload.config.ts's filename() generates -
// also doubles as the path-traversal guard for the GET route below.
const RECEIPT_FILENAME_PATTERN = /^[a-f0-9]{32}\.(?:png|jpe?g|webp|pdf)$/;

const RECEIPT_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

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
    const url = `${request.protocol}://${request.get('host')}/expenses/receipts/${file.filename}`;
    return { url };
  }

  @Get('receipts/:filename')
  async getReceipt(@Param('filename') filename: string, @Res() response: Response): Promise<void> {
    // Deliberately not app.useStaticAssets()/express.static: on this
    // Passenger/LiteSpeed deploy target, streaming an existing static file
    // through it returns a bare 500 "Internal error" with no trace in this
    // app's own logs (confirmed: a 404 for a missing file DOES come back as
    // this app's normal JSON error - only an existing file's stream fails,
    // which points at Passenger's response handling, not this app). Reading
    // the whole file into memory and sending it as a complete buffer avoids
    // whatever that streaming interaction is - fine at the 5MB cap these
    // are limited to.
    if (!RECEIPT_FILENAME_PATTERN.test(filename)) {
      throw new NotFoundException('Receipt not found.');
    }
    const ext = filename.split('.').pop()!;
    let buffer: Buffer;
    try {
      buffer = await readFile(receiptFilePath(filename));
    } catch {
      throw new NotFoundException('Receipt not found.');
    }
    response.setHeader('Content-Type', RECEIPT_CONTENT_TYPES[ext] ?? 'application/octet-stream');
    response.send(buffer);
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
