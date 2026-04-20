import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationStage, ProjectStageFinalResultStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
};

export class GradesStudentsQueryDto {
  @ApiProperty({ enum: EvaluationStage, description: 'Target evaluation stage' })
  @IsEnum(EvaluationStage)
  stage: EvaluationStage;

  @ApiPropertyOptional({
    description: 'Target department id. Defaults to authenticated user department',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Search by student name, email, project title, or group name',
    maxLength: 200,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    enum: ProjectStageFinalResultStatus,
    description: 'Filter by project finalization/review status',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsEnum(ProjectStageFinalResultStatus)
  finalizationStatus?: ProjectStageFinalResultStatus;

  @ApiPropertyOptional({ description: 'Filter by letter grade', example: 'A-' })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsString()
  @MaxLength(5)
  letterGrade?: string;

  @ApiPropertyOptional({ description: 'Minimum final grade filter', minimum: 0, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  @Max(100)
  minFinalGrade?: number;

  @ApiPropertyOptional({ description: 'Maximum final grade filter', minimum: 0, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  @Max(100)
  maxFinalGrade?: number;

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