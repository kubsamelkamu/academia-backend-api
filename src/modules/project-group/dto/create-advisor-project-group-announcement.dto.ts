import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  CreateProjectGroupAnnouncementDto,
  PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES,
  type ProjectGroupAnnouncementPriority,
} from './create-project-group-announcement.dto';

export class CreateAdvisorProjectGroupAnnouncementDto extends CreateProjectGroupAnnouncementDto {
  @ApiProperty({ description: 'Project id (must be advised by current advisor)' })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  projectId!: string;

  @ApiPropertyOptional({
    description: 'Optional deadline (ISO string). Enables student countdown UI.',
    example: '2026-04-10T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'deadlineAt must be a valid ISO date string' })
  deadlineAt?: string;

  @ApiPropertyOptional({
    description: 'If true (default), announcement becomes disabled after deadline is passed.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  disableAfterDeadline?: boolean;
}
