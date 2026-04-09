import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelAdvisorProjectGroupMeetingDto {
  @ApiPropertyOptional({
    description: 'Optional cancellation reason to show in history and notifications',
    example: 'Advisor unavailable due to departmental emergency.',
  })
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
