import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export enum DepartmentAnnouncementActionTypeDto {
  FORM_PROJECT_GROUP = 'FORM_PROJECT_GROUP',
  SUBMIT_PROPOSAL = 'SUBMIT_PROPOSAL',
  UPLOAD_DOCUMENT = 'UPLOAD_DOCUMENT',
  REGISTER_PRESENTATION = 'REGISTER_PRESENTATION',
  CUSTOM_ACTION = 'CUSTOM_ACTION',
}

export class CreateDepartmentAnnouncementDto {
  @ApiProperty({ description: 'Announcement title', maxLength: 255 })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Announcement message', maxLength: 5000 })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  @ApiProperty({ enum: DepartmentAnnouncementActionTypeDto })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsEnum(DepartmentAnnouncementActionTypeDto)
  actionType!: DepartmentAnnouncementActionTypeDto;

  @ApiPropertyOptional({ description: 'Optional CTA label for students', maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
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

  @ApiPropertyOptional({
    description: 'Optional deadline in ISO format (UTC recommended)',
    example: '2026-03-26T10:00:00.000Z',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
  )
  @IsDateString()
  deadlineAt?: string;
}
