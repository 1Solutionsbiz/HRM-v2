import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MoodLevel } from '../../generated/prisma/enums.js';
import { MOOD_TAGS } from '../mood-tags.js';

export class SubmitMoodCheckInDto {
  @IsIn(Object.values(MoodLevel))
  mood!: MoodLevel;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(MOOD_TAGS, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
