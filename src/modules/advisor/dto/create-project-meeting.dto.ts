import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ProjectMeetingType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => String(value ?? '').trim();
const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? undefined : normalized;
};

export class CreateProjectMeetingDto {
  @ApiProperty({ description: 'Project id for the meeting' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty({ description: 'Meeting title' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Meeting date in YYYY-MM-DD format' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ description: 'Meeting time in HH:mm format' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  time!: string;

  @ApiPropertyOptional({ description: 'Duration in minutes', default: 60 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @ApiPropertyOptional({ enum: ProjectMeetingType, default: ProjectMeetingType.VIRTUAL })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(ProjectMeetingType)
  type?: ProjectMeetingType;

  @ApiPropertyOptional({ description: 'Meeting location or virtual link', maxLength: 255 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ description: 'Meeting agenda', maxLength: 5000 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  agenda?: string;
}
