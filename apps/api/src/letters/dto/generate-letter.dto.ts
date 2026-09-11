import { IsObject, IsOptional, IsString } from 'class-validator';

export class GenerateLetterDto {
  @IsString()
  employeeId!: string;

  @IsString()
  letterTypeId!: string;

  /** Defaults to the letter type's active template when omitted. */
  @IsOptional()
  @IsString()
  templateId?: string;

  /**
   * Keys must exactly match the letter type's declared custom-variable set
   * (see LETTER_TYPE_CUSTOM_VARIABLES) - validated in the service, not here,
   * since the allowed key set is per-letter-type and class-validator can't
   * express that declaratively.
   */
  @IsOptional()
  @IsObject()
  customVariables?: Record<string, string>;
}
