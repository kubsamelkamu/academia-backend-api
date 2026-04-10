import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Max,
  MaxLength,
  Min,
  IsEnum,
} from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Filter records from this created date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter records up to this updated date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Target department id. Defaults to authenticated user department',
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Search advisors by first name, last name, or email',
    maxLength: 200,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized.length ? normalized : undefined;
  })
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number for advisor list pagination',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of advisors per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: ProjectStatus,
    description: 'Filter advisor projects by project status',
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  projectStatus?: ProjectStatus;
}
