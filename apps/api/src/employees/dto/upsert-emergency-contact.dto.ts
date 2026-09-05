import { IsString, MaxLength } from 'class-validator';

export class UpsertEmergencyContactDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  relationship!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;
}
