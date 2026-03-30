import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProjectEvaluationPriority, ProjectEvaluationStatus } from '@prisma/client';

const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? undefined : normalized;
};

export class UpdateProjectEvaluationDto {
  @ApiPropertyOptional({ description: 'Evaluation summary' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary?: string;

  @ApiPropertyOptional({ description: 'Advisor feedback' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;

  @ApiPropertyOptional({ description: 'Optional grade label' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  grade?: string;

  @ApiPropertyOptional({ enum: ProjectEvaluationStatus })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(ProjectEvaluationStatus)
  status?: ProjectEvaluationStatus;

  @ApiPropertyOptional({ enum: ProjectEvaluationPriority })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(ProjectEvaluationPriority)
  priority?: ProjectEvaluationPriority;

  @ApiPropertyOptional({ description: 'Optional due date' })
  @Transform(trimOptional)
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Optional project type label' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  projectType?: string;
}
