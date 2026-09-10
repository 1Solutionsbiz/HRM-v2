import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { AnnouncementsService } from './announcements.service.js';
import { PublishAnnouncementDto } from './dto/publish-announcement.dto.js';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js';
import {
  announcementImageFilePath,
  announcementImageMulterOptions,
} from './announcement-image-upload.config.js';

// Matches exactly what announcement-image-upload.config.ts's filename()
// generates - also doubles as the path-traversal guard for the GET route.
const IMAGE_FILENAME_PATTERN = /^[a-f0-9]{32}\.(?:png|jpe?g|webp)$/;
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  getAll(@CurrentUser() actor: AuthContext) {
    return this.announcementsService.getAllForUser(actor.userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.announcementsService.markRead(actor.userId, id);
  }

  @Post('images')
  @RequirePermissions('announcement:publish')
  @UseInterceptors(FileInterceptor('file', announcementImageMulterOptions))
  uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ): { url: string } {
    if (!file) throw new BadRequestException('No file was uploaded.');
    // Absolute, not relative: the web app calls this API from a different
    // origin (hrm.1solutions.biz vs hrm-api.1solutions.biz), so a relative
    // path would resolve against the wrong host if stored as-is.
    const url = `${request.protocol}://${request.get('host')}/announcements/images/${file.filename}`;
    return { url };
  }

  @Get('images/:filename')
  @Public()
  async getImage(@Param('filename') filename: string, @Res() response: Response): Promise<void> {
    // @Public(): an <img src> pointing here never carries the app's Bearer
    // token (localStorage, not a cookie), so this 401'd for every real
    // browser render until this was added - security relies on the
    // unguessable 32-hex-char filename (128 bits of entropy), same
    // tradeoff as an S3 presigned URL, not on session auth.
    if (!IMAGE_FILENAME_PATTERN.test(filename)) {
      throw new NotFoundException('Image not found.');
    }
    const ext = filename.split('.').pop()!;
    let buffer: Buffer;
    try {
      buffer = await readFile(announcementImageFilePath(filename));
    } catch {
      throw new NotFoundException('Image not found.');
    }
    response.setHeader('Content-Type', IMAGE_CONTENT_TYPES[ext] ?? 'application/octet-stream');
    response.end(buffer);
  }

  @Post()
  @RequirePermissions('announcement:publish')
  publish(
    @Body() dto: PublishAnnouncementDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.announcementsService.publish(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('announcement:publish')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.announcementsService.update(id, dto, actor);
  }
}
