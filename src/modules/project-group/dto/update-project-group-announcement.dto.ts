import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

import { PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES } from './create-project-group-announcement.dto';

export class UpdateProjectGroupAnnouncementDto {
  @ApiPropertyOptional({ description: 'Announcement title', maxLength: 255 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim()
  )
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Priority',
    enum: PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim().toUpperCase()
  )
  @IsString()
  @IsIn(PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({ description: 'Announcement message', maxLength: 5000 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim()
  )
  @IsString()
  @MaxLength(5000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Replace attachment with a URL (use this OR upload a file, not both)',
    example: 'https://example.com/file.pdf',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || String(value).trim() === ''
      ? undefined
      : String(value).trim()
  )
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'attachmentUrl must be a valid URL' })
  attachmentUrl?: string;

  @ApiPropertyOptional({ description: 'Remove the existing attachment', default: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  })
  @IsBoolean()
  removeAttachment?: boolean;
}
