import { IsString } from 'class-validator';

export class SendWelcomeNowDto {
  /** Required, unlike the test DTO's optional employeeId - a real, company-wide send must name who explicitly, never "whoever's most recent." */
  @IsString()
  employeeId!: string;
}
