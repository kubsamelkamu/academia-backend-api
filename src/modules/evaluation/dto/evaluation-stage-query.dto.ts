import { EvaluationStage } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class EvaluationStageQueryDto {
  @ApiProperty({ enum: EvaluationStage })
  @IsEnum(EvaluationStage)
  stage: EvaluationStage;
}