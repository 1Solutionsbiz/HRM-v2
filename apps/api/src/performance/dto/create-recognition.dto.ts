import { IsString, MaxLength } from 'class-validator';

export class CreateRecognitionDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  /** Free text, not a FK — mixes program names ("Employee of the Month") and person names (a peer nomination). */
  @IsString()
  @MaxLength(200)
  source!: string;
}
