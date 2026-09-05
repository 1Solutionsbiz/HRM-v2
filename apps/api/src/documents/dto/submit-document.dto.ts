import { IsUrl, MaxLength } from 'class-validator';

export class SubmitDocumentDto {
  /**
   * No file storage integration exists yet (no provider chosen) — this
   * accepts the URL of an already-uploaded file rather than a file body.
   * Whoever wires up real uploads (S3, etc.) decides where this URL comes
   * from; the API only ever records it.
   */
  @IsUrl()
  @MaxLength(2000)
  fileUrl!: string;
}
