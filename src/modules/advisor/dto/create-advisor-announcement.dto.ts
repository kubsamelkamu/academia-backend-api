import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  AdvisorAnnouncementAudience,
  AdvisorAnnouncementPriority,
  AdvisorAnnouncementStatus,
} from '@prisma/client';

const trim = ({ value }: { value: unknown }) => String(value ?? '').trim();
const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? undefined : normalized;
};
const parseStringArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const raw = String(value).trim();
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return raw.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
};

export class CreateAdvisorAnnouncementDto {
  @ApiProperty({ description: 'Announcement title' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Announcement content' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ enum: AdvisorAnnouncementPriority })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(AdvisorAnnouncementPriority)
  priority?: AdvisorAnnouncementPriority;

  @ApiPropertyOptional({ enum: AdvisorAnnouncementStatus })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(AdvisorAnnouncementStatus)
  status?: AdvisorAnnouncementStatus;

  @ApiPropertyOptional({ enum: AdvisorAnnouncementAudience })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(AdvisorAnnouncementAudience)
  audience?: AdvisorAnnouncementAudience;

  @ApiPropertyOptional({ description: 'Optional deadline' })
  @Transform(trimOptional)
  @IsOptional()
  @IsDateString()
  deadlineAt?: string;

  @ApiPropertyOptional({ description: 'Optional project ids as array or JSON string', type: [String] })
  @Transform(parseStringArray)
  @IsOptional()
  targetProjectIds?: string[];

  @ApiPropertyOptional({ description: 'Optional external attachment URL' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}
