import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectGroupStatus, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
};

const normalizeOptionalBoolean = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
};

export class StudentDirectoryQueryDto {
  @ApiPropertyOptional({
    description: 'Target department id. Defaults to authenticated user department',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Search students by first name, last name, or email',
    maxLength: 200,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by account status',
    enum: UserStatus,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsEnum(UserStatus)
  userStatus?: UserStatus;

  @ApiPropertyOptional({
    description: 'Filter by project group review status',
    enum: ProjectGroupStatus,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsEnum(ProjectGroupStatus)
  groupStatus?: ProjectGroupStatus;

  @ApiPropertyOptional({
    description: 'Filter students by whether they currently belong to a project group',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalBoolean(value))
  @IsBoolean()
  hasGroup?: boolean;

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