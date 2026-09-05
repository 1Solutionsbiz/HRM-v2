import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const DECISIONS = ['VERIFIED', 'REJECTED'] as const;

export class VerifyDocumentDto {
  @IsIn(DECISIONS)
  decision!: (typeof DECISIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
