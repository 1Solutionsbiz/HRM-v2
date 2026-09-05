import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { DocumentsService } from './documents.service.js';
import { SubmitDocumentDto } from './dto/submit-document.dto.js';
import { VerifyDocumentDto } from './dto/verify-document.dto.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('types')
  getDocumentTypes() {
    return this.documentsService.getDocumentTypes();
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
