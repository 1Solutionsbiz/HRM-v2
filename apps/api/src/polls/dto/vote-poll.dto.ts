import { IsString, MinLength } from 'class-validator';

export class VotePollDto {
  @IsString()
  @MinLength(1)
  optionId!: string;
}
