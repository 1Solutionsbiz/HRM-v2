import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const DECISIONS = ['APPROVED', 'DECLINED'] as const;

export class DecideResignationDto {
  @IsIn(DECISIONS)
  decision!: (typeof DECISIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNote?: string;
}
