import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationSeverity } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { CoordinatorAdvisorNotificationDeliveryMethodDto } from './create-coordinator-advisor-notification.dto';

export class ListCoordinatorAdvisorNotificationsQueryDto {
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

  @ApiPropertyOptional({ enum: CoordinatorAdvisorNotificationDeliveryMethodDto })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim().toUpperCase()
  )
  @IsEnum(CoordinatorAdvisorNotificationDeliveryMethodDto)
  deliveryMethod?: CoordinatorAdvisorNotificationDeliveryMethodDto;

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
