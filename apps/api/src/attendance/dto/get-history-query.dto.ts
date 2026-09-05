import { IsDateString, IsOptional } from 'class-validator';

export class GetHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
