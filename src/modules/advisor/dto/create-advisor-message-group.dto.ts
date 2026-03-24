import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AdvisorMessageGroupPrivacy } from '@prisma/client';

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

export class CreateAdvisorMessageGroupDto {
  @ApiProperty({ description: 'Message group name' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional project id associated with the group' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Optional group description' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: AdvisorMessageGroupPrivacy })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase() || undefined)
  @IsOptional()
  @IsEnum(AdvisorMessageGroupPrivacy)
  privacy?: AdvisorMessageGroupPrivacy;

  @ApiPropertyOptional({ description: 'Member user ids', type: [String] })
  @Transform(parseStringArray)
  @IsOptional()
  memberUserIds?: string[];
}
