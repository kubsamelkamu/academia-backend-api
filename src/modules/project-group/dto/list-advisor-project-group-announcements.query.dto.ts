import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

import { ListProjectGroupAnnouncementsQueryDto } from './list-project-group-announcements.query.dto';

export class ListAdvisorProjectGroupAnnouncementsQueryDto extends ListProjectGroupAnnouncementsQueryDto {
  @ApiProperty({ description: 'Project id (must be advised by current advisor)' })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  projectId!: string;
}
