import { IsString, MaxLength } from 'class-validator';

export class UpdateHandbookSectionDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsString()
  @MaxLength(20000)
  body!: string;
}
