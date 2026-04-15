import { ApiProperty } from '@nestjs/swagger';
import { EvaluationStage } from '@prisma/client';
import { IsEnum, IsInt, Max, Min } from 'class-validator';

export class UpdateDepartmentStageEvaluationWeightDto {
  @ApiProperty({ enum: EvaluationStage, example: EvaluationStage.CAPSTONE_I })
  @IsEnum(EvaluationStage)
  stage: EvaluationStage;

  @ApiProperty({ example: 40, minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  advisorPercentage: number;

  @ApiProperty({ example: 60, minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  evaluatorPercentage: number;
}