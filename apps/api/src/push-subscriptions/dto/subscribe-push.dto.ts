import { IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PushSubscriptionKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

/** Mirrors the browser's `PushSubscription.toJSON()` shape exactly - the frontend posts that object unchanged. */
export class SubscribePushDto {
  @IsString()
  @MaxLength(500)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}
