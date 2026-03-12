import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export const PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type ProjectGroupAnnouncementPriority =
  (typeof PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES)[number];

export class CreateProjectGroupAnnouncementDto {
  @ApiProperty({ description: 'Announcement title', maxLength: 255 })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Priority',
    enum: PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES,
    default: 'MEDIUM',
  })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsString()
  @IsIn(PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES)
  priority!: ProjectGroupAnnouncementPriority;

  @ApiProperty({ description: 'Announcement message', maxLength: 5000 })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({
    description: 'Optional attachment link (use this OR upload a file, not both)',
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
}
