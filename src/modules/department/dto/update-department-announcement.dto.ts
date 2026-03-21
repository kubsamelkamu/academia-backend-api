import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

import { DepartmentAnnouncementActionTypeDto } from './create-department-announcement.dto';

export class UpdateDepartmentAnnouncementDto {
  @ApiPropertyOptional({ description: 'Announcement title', maxLength: 255 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim()
  )
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Announcement message', maxLength: 5000 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim()
  )
  @IsString()
  @MaxLength(5000)
  message?: string;

  @ApiPropertyOptional({ enum: DepartmentAnnouncementActionTypeDto })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim().toUpperCase()
  )
  @IsEnum(DepartmentAnnouncementActionTypeDto)
  actionType?: DepartmentAnnouncementActionTypeDto;

  @ApiPropertyOptional({ description: 'Optional CTA label for students', maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim()
  )
  @IsString()
  @MaxLength(120)
  actionLabel?: string;

  @ApiPropertyOptional({ description: 'Optional CTA URL for students' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
  )
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'actionUrl must be a valid URL' })
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Optional deadline in ISO format (UTC recommended)' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
  )
  @IsDateString()
  deadlineAt?: string;

  @ApiPropertyOptional({ description: 'Remove existing deadline', default: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  })
  @IsBoolean()
  clearDeadline?: boolean;
}
