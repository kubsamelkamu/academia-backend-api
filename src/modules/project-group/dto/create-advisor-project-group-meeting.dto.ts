import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateAdvisorProjectGroupMeetingDto {
  @ApiProperty({ description: 'Project id (must be advised by current advisor)' })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  projectId!: string;

  @ApiProperty({ description: 'Meeting title', example: 'Sprint Planning - Week 3' })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Meeting date/time in ISO format',
    example: '2026-04-12T13:00:00.000Z',
  })
  @IsDateString({}, { message: 'meetingAt must be a valid ISO date string' })
  meetingAt!: string;

  @ApiProperty({
    description: 'Meeting duration in minutes',
    example: 60,
    minimum: 15,
  })
  @IsInt()
  @Min(15)
  durationMinutes!: number;

  @ApiProperty({
    description: 'Meeting agenda/details',
    example: 'Discuss milestone progress, blockers, and next actions.',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  agenda!: string;
}
