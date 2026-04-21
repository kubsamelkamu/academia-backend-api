import { ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationStage, NotificationSeverity } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { CoordinatorEvaluatorNotificationDeliveryMethodDto } from './create-coordinator-evaluator-notification.dto';

export class ListCoordinatorEvaluatorNotificationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: EvaluationStage })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim().toUpperCase()
  )
  @IsEnum(EvaluationStage)
  stage?: EvaluationStage;

  @ApiPropertyOptional({ enum: CoordinatorEvaluatorNotificationDeliveryMethodDto })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim().toUpperCase()
  )
  @IsEnum(CoordinatorEvaluatorNotificationDeliveryMethodDto)
  deliveryMethod?: CoordinatorEvaluatorNotificationDeliveryMethodDto;

  @ApiPropertyOptional({ enum: NotificationSeverity })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim().toUpperCase()
  )
  @IsEnum(NotificationSeverity)
  priority?: NotificationSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
  )
  @IsString()
  search?: string;
}

export class ListCoordinatorEvaluatorNotificationRecipientsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: EvaluationStage })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(EvaluationStage)
  stage!: EvaluationStage;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
  )
  @IsString()
  search?: string;
}