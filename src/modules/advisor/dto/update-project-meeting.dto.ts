import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ProjectMeetingType, ProjectMeetingStatus } from '@prisma/client';

const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized == '' ? undefined : normalized;
};

export class UpdateProjectMeetingDto {
  @ApiPropertyOptional({ description: 'Meeting title' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Meeting date in YYYY-MM-DD format' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Meeting time in HH:mm format' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @ApiPropertyOptional({ enum: ProjectMeetingType })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(ProjectMeetingType)
  type?: ProjectMeetingType;

  @ApiPropertyOptional({ enum: ProjectMeetingStatus })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(ProjectMeetingStatus)
  status?: ProjectMeetingStatus;

  @ApiPropertyOptional({ description: 'Meeting location or virtual link' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ description: 'Meeting agenda' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  agenda?: string;
}
