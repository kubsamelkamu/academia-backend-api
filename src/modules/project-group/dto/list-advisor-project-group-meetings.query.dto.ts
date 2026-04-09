import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

import { ListProjectGroupAnnouncementsQueryDto } from './list-project-group-announcements.query.dto';

export const ADVISOR_MEETING_FILTERS = ['ALL', 'UPCOMING_REMINDERS', 'CANCELLED'] as const;
export type AdvisorMeetingFilter = (typeof ADVISOR_MEETING_FILTERS)[number];

export class ListAdvisorProjectGroupMeetingsQueryDto extends ListProjectGroupAnnouncementsQueryDto {
  @ApiProperty({ description: 'Project id (must be advised by current advisor)' })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  projectId!: string;

  @ApiPropertyOptional({
    description: 'Optional advisor dashboard filter',
    enum: ADVISOR_MEETING_FILTERS,
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(ADVISOR_MEETING_FILTERS)
  filter?: AdvisorMeetingFilter;

  @ApiPropertyOptional({
    description: 'Reminder window hours (applies when filter=UPCOMING_REMINDERS)',
    enum: [24, 1],
    default: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([24, 1])
  reminderWindowHours?: number;
}
