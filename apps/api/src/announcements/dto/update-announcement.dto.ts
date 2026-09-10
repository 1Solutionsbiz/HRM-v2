import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { AnnouncementCategory } from '../../generated/prisma/enums.js';

/**
 * Same shape as PublishAnnouncementDto, except imageUrl is nullable: the
 * client always sends either a URL or explicit null (never omits the
 * field), so the service can tell "no image" apart from "field untouched"
 * on a Prisma update - an omitted/undefined field would leave a stale
 * imageUrl in place instead of clearing it.
 */
export class UpdateAnnouncementDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsString()
  @MaxLength(10000)
  body!: string;

  @IsIn(Object.values(AnnouncementCategory))
  category!: AnnouncementCategory;

  @IsOptional()
  @IsUrl()
  imageUrl?: string | null;
}
