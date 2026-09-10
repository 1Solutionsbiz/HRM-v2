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
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { DocumentsService } from './documents.service.js';
import { SubmitDocumentDto } from './dto/submit-document.dto.js';
import { VerifyDocumentDto } from './dto/verify-document.dto.js';
import {
  employeeDocumentFilePath,
  employeeDocumentMulterOptions,
} from './document-upload.config.js';

// Matches exactly what document-upload.config.ts's filename() generates -
// also doubles as the path-traversal guard for the GET route below.
const DOCUMENT_FILENAME_PATTERN = /^[a-f0-9]{32}\.(?:png|jpe?g|webp|pdf)$/;
const DOCUMENT_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('types')
  getDocumentTypes() {
    return this.documentsService.getDocumentTypes();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', employeeDocumentMulterOptions))
  uploadDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ): { url: string } {
    if (!file) throw new BadRequestException('No file was uploaded.');
    // Absolute, not relative: the web app calls this API from a different
    // origin (hrm.1solutions.biz vs hrm-api.1solutions.biz), so a relative
    // path would resolve against the wrong host if stored as-is.
    const url = `${request.protocol}://${request.get('host')}/documents/files/${file.filename}`;
    return { url };
  }

  @Get('files/:filename')
  @Public()
  async getDocumentFile(@Param('filename') filename: string, @Res() response: Response): Promise<void> {
    // @Public(): see the identical comment on ExpensesController.getReceipt
    // - an <a href> to this URL never carries the app's Bearer token, so
    // security relies on the unguessable 32-hex-char filename instead.
    if (!DOCUMENT_FILENAME_PATTERN.test(filename)) {
      throw new NotFoundException('Document not found.');
    }
    const ext = filename.split('.').pop()!;
    let buffer: Buffer;
    try {
      buffer = await readFile(employeeDocumentFilePath(filename));
    } catch {
      throw new NotFoundException('Document not found.');
    }
    response.setHeader('Content-Type', DOCUMENT_CONTENT_TYPES[ext] ?? 'application/octet-stream');
    response.send(buffer);
  }

  @Get('mine')
  getMyDocuments(@CurrentUser() actor: AuthContext) {
    return this.documentsService.getMyDocuments(actor.userId);
  }

  @Post('mine/:documentTypeId/submit')
  submitDocument(
    @Param('documentTypeId') documentTypeId: string,
    @Body() dto: SubmitDocumentDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.documentsService.submitDocument(
      actor.userId,
      documentTypeId,
      dto,
      actor,
    );
  }

  @Get('employees/:employeeId')
  @RequirePermissions('employee:manage')
  getEmployeeDocuments(@Param('employeeId') employeeId: string) {
    return this.documentsService.getEmployeeDocuments(employeeId);
  }

  @Patch('employees/:employeeId/:documentTypeId/verify')
  @RequirePermissions('employee:manage')
  verifyDocument(
    @Param('employeeId') employeeId: string,
    @Param('documentTypeId') documentTypeId: string,
    @Body() dto: VerifyDocumentDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.documentsService.verifyDocument(
      employeeId,
      documentTypeId,
      dto,
      actor,
    );
  }
}
