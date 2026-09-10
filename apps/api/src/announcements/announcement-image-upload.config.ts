import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { BadRequestException } from '@nestjs/common';
// Not re-exported from the package's top-level index in this version -
// the deep subpath below is what @nestjs/platform-express's own exports
// map ("./*") allows for.
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { diskStorage } from 'multer';

/**
 * Resolved once at import time, not per-request: UPLOADS_DIR is a static
 * boot-time env var (see environment.ts), and Nest's FileInterceptor takes
 * its multer config as a plain object outside the DI/request context, so
 * this can't go through ConfigService.
 */
export function announcementImagesDir(): string {
  return resolve(process.env.UPLOADS_DIR ?? './uploads', 'announcement-images');
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const announcementImageMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dir = announcementImagesDir();
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      // Random, not the original filename: avoids path-traversal/collision
      // concerns and doesn't leak whatever the publisher named the file.
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${randomBytes(16).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new BadRequestException('Announcement images must be a JPEG, PNG, or WEBP file.'), false);
      return;
    }
    cb(null, true);
  },
};

export function announcementImageFilePath(filename: string): string {
  return join(announcementImagesDir(), filename);
}
