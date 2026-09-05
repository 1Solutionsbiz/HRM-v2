import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  cycleId!: string;

  @IsNumber()
  @Min(0)
  rating!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxRating?: number;

  @IsString()
  @MaxLength(2000)
  summary!: string;
}
