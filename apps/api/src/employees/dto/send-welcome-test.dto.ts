import { IsOptional, IsString } from 'class-validator';

export class SendWelcomeTestDto {
  /** Preview using this employee's real data; defaults to the most recently joined active employee. */
  @IsOptional()
  @IsString()
  employeeId?: string;
}
