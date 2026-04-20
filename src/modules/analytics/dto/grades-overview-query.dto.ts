import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GradesOverviewQueryDto {
  @ApiProperty({ enum: EvaluationStage, description: 'Target evaluation stage' })
  @IsEnum(EvaluationStage)
  stage: EvaluationStage;

  @ApiPropertyOptional({ description: 'Target department id. Defaults to authenticated user department' })
  @IsOptional()
  @IsString()
  departmentId?: string;
}