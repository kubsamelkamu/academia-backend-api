import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProposalRejectionReminderDto {
  @ApiPropertyOptional({
    description: 'Optional reminder title shown to the rejected proposal group',
    example: 'Proposal Resubmission Reminder',
    maxLength: 255,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
  )
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional reminder message shown to the rejected proposal group',
    example: 'Please revise and resubmit your proposal before the deadline.',
    maxLength: 5000,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
  )
  @IsString()
  @MaxLength(5000)
  message?: string;

  @ApiProperty({
    description: 'Deadline for the rejected proposal group to revise and resubmit',
    example: '2026-04-10T12:00:00.000Z',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsDateString()
  @IsNotEmpty()
  deadlineAt!: string;

  @ApiPropertyOptional({
    description: 'Whether the reminder should become inactive after the deadline passes',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).trim().toLowerCase() === 'true';
  })
  @IsBoolean()
  disableAfterDeadline?: boolean;
}