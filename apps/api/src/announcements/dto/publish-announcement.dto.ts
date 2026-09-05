import { IsIn, IsString, MaxLength } from 'class-validator';
import { AnnouncementCategory } from '../../generated/prisma/enums.js';

export class PublishAnnouncementDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsString()
  @MaxLength(10000)
  body!: string;

  @IsIn(Object.values(AnnouncementCategory))
  category!: AnnouncementCategory;
}
