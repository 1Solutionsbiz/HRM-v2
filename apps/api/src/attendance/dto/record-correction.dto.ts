import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AttendanceEventType } from '../../generated/prisma/enums.js';

const CORRECTABLE_TYPES = [
  AttendanceEventType.CHECK_IN,
  AttendanceEventType.CHECK_OUT,
  AttendanceEventType.BREAK_START,
  AttendanceEventType.BREAK_END,
] as const;

export class RecordCorrectionDto {
  @IsIn(CORRECTABLE_TYPES)
  type!: (typeof CORRECTABLE_TYPES)[number];

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
