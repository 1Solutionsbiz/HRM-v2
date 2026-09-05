import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const DECISIONS = ['APPROVED', 'REJECTED'] as const;

export class DecideExpenseClaimDto {
  @IsIn(DECISIONS)
  decision!: (typeof DECISIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNote?: string;
}
