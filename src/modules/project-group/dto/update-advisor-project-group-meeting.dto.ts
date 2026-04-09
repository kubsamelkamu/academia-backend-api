import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAdvisorProjectGroupMeetingDto {
  @ApiPropertyOptional({ description: 'Meeting title', example: 'Weekly Progress Check (Updated)' })
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Meeting date/time in ISO format (must be future)',
    example: '2026-04-16T14:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'meetingAt must be a valid ISO date string' })
  meetingAt?: string;

  @ApiPropertyOptional({
    description: 'Meeting duration in minutes',
    example: 90,
    minimum: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Meeting agenda/details',
    example: 'Review milestones and confirm next sprint tasks.',
  })
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MaxLength(5000)
  agenda?: string;
}
