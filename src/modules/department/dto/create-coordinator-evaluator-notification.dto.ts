import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationStage, NotificationSeverity } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum CoordinatorEvaluatorNotificationRecipientModeDto {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
  ALL = 'ALL',
}

export enum CoordinatorEvaluatorNotificationDeliveryMethodDto {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  BOTH = 'BOTH',
}

export class CreateCoordinatorEvaluatorNotificationDto {
  @ApiProperty({ enum: CoordinatorEvaluatorNotificationRecipientModeDto })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(CoordinatorEvaluatorNotificationRecipientModeDto)
  recipientMode!: CoordinatorEvaluatorNotificationRecipientModeDto;

  @ApiPropertyOptional({
    type: [String],
    description: 'Evaluator user ids. Required for SINGLE and MULTIPLE.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  evaluatorUserIds?: string[];

  @ApiProperty({ enum: EvaluationStage })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(EvaluationStage)
  stage!: EvaluationStage;

  @ApiProperty({ enum: NotificationSeverity })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(NotificationSeverity)
  priority!: NotificationSeverity;

  @ApiProperty({ enum: CoordinatorEvaluatorNotificationDeliveryMethodDto })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(CoordinatorEvaluatorNotificationDeliveryMethodDto)
  deliveryMethod!: CoordinatorEvaluatorNotificationDeliveryMethodDto;

  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MaxLength(255)
  subject!: string;

  @ApiProperty({ maxLength: 5000 })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MaxLength(5000)
  message!: string;
}