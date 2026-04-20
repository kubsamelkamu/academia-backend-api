import { ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationStage, ProjectStageFinalResultStatus, ProjectStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  EXCEL = 'excel',
}

export enum GradesReportScope {
  PROJECTS = 'projects',
  STUDENTS = 'students',
}

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
};

export class ReportQueryDto {
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiPropertyOptional({ description: 'Target evaluation stage for grading exports', enum: EvaluationStage })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsEnum(EvaluationStage)
  stage?: EvaluationStage;

  @ApiPropertyOptional({
    description: 'Grades export dataset scope',
    enum: GradesReportScope,
    default: GradesReportScope.PROJECTS,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toLowerCase())
  @IsEnum(GradesReportScope)
  scope?: GradesReportScope;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  departmentId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  startDate?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  advisorId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Search by project, group, advisor, or student identifiers', maxLength: 200 })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, description: 'Project status filter for project-scope grade exports' })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsEnum(ProjectStatus)
  projectStatus?: ProjectStatus;

  @ApiPropertyOptional({
    enum: ['WAITING_FOR_WEIGHTS', 'WAITING_FOR_ADVISOR', 'WAITING_FOR_EVALUATORS', 'READY_FOR_AGGREGATION'],
    description: 'Aggregation status filter for project-scope grade exports',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsIn(['WAITING_FOR_WEIGHTS', 'WAITING_FOR_ADVISOR', 'WAITING_FOR_EVALUATORS', 'READY_FOR_AGGREGATION'])
  aggregationStatus?: 'WAITING_FOR_WEIGHTS' | 'WAITING_FOR_ADVISOR' | 'WAITING_FOR_EVALUATORS' | 'READY_FOR_AGGREGATION';

  @ApiPropertyOptional({
    enum: ['NOT_FINALIZED', ...Object.values(ProjectStageFinalResultStatus)],
    description: 'Finalization status filter for project-scope grade exports',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value)?.toUpperCase())
  @IsIn(['NOT_FINALIZED', ...Object.values(ProjectStageFinalResultStatus)])
  finalizationStatus?: 'NOT_FINALIZED' | ProjectStageFinalResultStatus;

  @ApiPropertyOptional({ description: 'Letter grade filter for student-scope grade exports', example: 'A-' })
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
}
