import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationSeverity } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum CoordinatorAdvisorNotificationRecipientModeDto {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
  ALL = 'ALL',
}

export enum CoordinatorAdvisorNotificationDeliveryMethodDto {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  BOTH = 'BOTH',
}

export class CreateCoordinatorAdvisorNotificationDto {
  @ApiProperty({ enum: CoordinatorAdvisorNotificationRecipientModeDto })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(CoordinatorAdvisorNotificationRecipientModeDto)
  recipientMode!: CoordinatorAdvisorNotificationRecipientModeDto;

  @ApiPropertyOptional({
    type: [String],
    description: 'Advisor user ids. Required for SINGLE and MULTIPLE.',
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
  advisorUserIds?: string[];

  @ApiProperty({ enum: NotificationSeverity })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(NotificationSeverity)
  priority!: NotificationSeverity;

  @ApiProperty({ enum: CoordinatorAdvisorNotificationDeliveryMethodDto })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(CoordinatorAdvisorNotificationDeliveryMethodDto)
  deliveryMethod!: CoordinatorAdvisorNotificationDeliveryMethodDto;

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