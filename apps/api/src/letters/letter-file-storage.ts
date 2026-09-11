import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Generated (not uploaded) files, so no multer/diskStorage here - the PDF
 * bytes come from pdfmake, not a client request body. Same UPLOADS_DIR
 * root and random-hex-filename convention as document-upload.config.ts /
 * avatar-upload.config.ts, but deliberately NOT served via an
 * unguessable-filename @Public() route the way those are: a generated
 * letter is a legal HR document, so its download route is a real
 * authenticated + scoped endpoint instead (see LettersController) - the
 * filename here only needs to be collision-proof, not secret.
 */
export function letterFilesDir(): string {
  return resolve(process.env.UPLOADS_DIR ?? './uploads', 'letters');
}

export const LETTER_FILENAME_PATTERN = /^[a-f0-9]{32}\.pdf$/;

export function letterFilePath(filename: string): string {
  return join(letterFilesDir(), filename);
}

export async function saveLetterPdf(buffer: Buffer): Promise<string> {
  const dir = letterFilesDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = `${randomBytes(16).toString('hex')}.pdf`;
  await writeFile(letterFilePath(filename), buffer);
  return filename;
}
