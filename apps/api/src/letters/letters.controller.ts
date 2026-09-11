import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { Response } from 'express';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { LettersService } from './letters.service.js';
import { SearchEmployeesQueryDto } from './dto/search-employees-query.dto.js';
import { GenerateLetterDto } from './dto/generate-letter.dto.js';
import { CancelLetterDto } from './dto/cancel-letter.dto.js';

@Controller('letters')
export class LettersController {
  constructor(private readonly lettersService: LettersService) {}

  @Get('employees')
  @RequirePermissions('letters:generate')
  searchEmployees(@Query() query: SearchEmployeesQueryDto, @CurrentUser() actor: AuthContext) {
    return this.lettersService.searchEmployees(actor, query);
  }

  @Get('categories')
  @RequirePermissions('letters:view')
  listCategories() {
    return this.lettersService.listCategories();
  }

  @Post('preview')
  @RequirePermissions('letters:generate')
  preview(@Body() dto: GenerateLetterDto, @CurrentUser() actor: AuthContext) {
    return this.lettersService.preview(actor, dto);
  }

  @Post('generate')
  @RequirePermissions('letters:generate')
  generate(@Body() dto: GenerateLetterDto, @CurrentUser() actor: AuthContext) {
    return this.lettersService.generate(actor, dto);
  }

  @Get()
  @RequirePermissions('letters:view')
  list(@Query('employeeId') employeeId: string | undefined, @CurrentUser() actor: AuthContext) {
    return this.lettersService.list(actor, employeeId);
  }

  /**
   * Genuinely authenticated + scoped, unlike documents/avatars' @Public() +
   * unguessable-filename pattern — a generated letter is a legal HR
   * document, and letters:download + per-employee scope is real
   * authorization, not obscurity.
   */
  @Get(':id/download')
  @RequirePermissions('letters:download')
  async download(
    @Param('id') id: string,
    @CurrentUser() actor: AuthContext,
    @Res() response: Response,
  ): Promise<void> {
    const { filePath, documentNumber } = await this.lettersService.getDownload(actor, id);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      throw new NotFoundException('Letter file not found');
    }
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${documentNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf"`,
    );
    response.send(buffer);
  }

  @Patch(':id/cancel')
  @RequirePermissions('letters:cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelLetterDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.lettersService.cancel(actor, id, dto);
  }
}
