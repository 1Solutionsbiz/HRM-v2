import { IsUrl, MaxLength } from 'class-validator';

export class SubmitDocumentDto {
  /**
   * A URL, not a file body — the client uploads the file to
   * POST /documents/upload first (see DocumentsController.uploadDocument)
   * and submits the URL it gets back here. Also accepts an externally
   * hosted link (Google Drive, etc.), which is why this stays a plain
   * URL field rather than being tied to the upload endpoint's own format.
   */
  @IsUrl()
  @MaxLength(2000)
  fileUrl!: string;
}
