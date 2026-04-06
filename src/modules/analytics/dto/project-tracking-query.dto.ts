import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
};

export class ProjectTrackingQueryDto {
  @ApiPropertyOptional({
    description: 'Target department id. Defaults to authenticated user department',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Search projects by project title, group name, or advisor name',
    maxLength: 200,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by project status',
    enum: ProjectStatus,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsEnum(ProjectStatus)
  projectStatus?: ProjectStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}