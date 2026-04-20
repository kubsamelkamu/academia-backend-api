import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationStage, ProjectStageFinalResultStatus, ProjectStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
};

export const GRADE_AGGREGATION_STATUSES = [
  'WAITING_FOR_WEIGHTS',
  'WAITING_FOR_ADVISOR',
  'WAITING_FOR_EVALUATORS',
  'READY_FOR_AGGREGATION',
] as const;

export const GRADE_FINALIZATION_STATUSES = [
  'NOT_FINALIZED',
  ...Object.values(ProjectStageFinalResultStatus),
] as const;

export class GradesProjectsQueryDto {
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
    description: 'Search by project title, group name, or advisor identity',
    maxLength: 200,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, description: 'Filter by project status' })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsEnum(ProjectStatus)
  projectStatus?: ProjectStatus;

  @ApiPropertyOptional({
    enum: GRADE_AGGREGATION_STATUSES,
    description: 'Filter by computed aggregation status',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsIn(GRADE_AGGREGATION_STATUSES)
  aggregationStatus?: (typeof GRADE_AGGREGATION_STATUSES)[number];

  @ApiPropertyOptional({
    enum: GRADE_FINALIZATION_STATUSES,
    description: 'Filter by finalization/review status',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsIn(GRADE_FINALIZATION_STATUSES)
  finalizationStatus?: (typeof GRADE_FINALIZATION_STATUSES)[number];

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