import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export enum EvaluationStatus {
  PENDING = 'PENDING',
  GRADED = 'GRADED',
}

export enum EvaluationType {
  PROPOSAL = 'proposal',
  MILESTONE = 'milestone',
  FINAL_DEFENSE = 'final_defense',
}

class ScoreCriterionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  criterion: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  feedback?: string;
}

export class CreateEvaluationDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  milestoneId?: string;

  @ApiProperty({ enum: EvaluationType })
  @IsEnum(EvaluationType)
  type: EvaluationType;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  score?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ type: [ScoreCriterionDto] })
  @IsArray()
  @IsOptional()
  criteriaScores?: ScoreCriterionDto[];

  @ApiProperty({ enum: EvaluationStatus, default: EvaluationStatus.PENDING })
  @IsEnum(EvaluationStatus)
  @IsOptional()
  status?: EvaluationStatus;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateEvaluationDto {
  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  score?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ type: [ScoreCriterionDto] })
  @IsArray()
  @IsOptional()
  criteriaScores?: ScoreCriterionDto[];

  @ApiProperty({ enum: EvaluationStatus })
  @IsEnum(EvaluationStatus)
  @IsOptional()
  status?: EvaluationStatus;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class EvaluationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectTitle: string;

  @ApiPropertyOptional()
  milestoneId?: string;

  @ApiPropertyOptional()
  milestoneTitle?: string;

  @ApiProperty()
  advisorId: string;

  @ApiProperty()
  advisorName: string;

  @ApiProperty({ enum: EvaluationType })
  type: EvaluationType;

  @ApiPropertyOptional()
  score?: number;

  @ApiPropertyOptional()
  comment?: string;

  @ApiPropertyOptional({ type: [Object] })
  criteriaScores?: any[];

  @ApiProperty({ enum: EvaluationStatus })
  status: EvaluationStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  submittedAt?: Date;

  @ApiPropertyOptional()
  studentNames?: string[];

  @ApiPropertyOptional()
  metadata?: Record<string, any>;
}
