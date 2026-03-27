import { ApiProperty } from '@nestjs/swagger';
import { ProjectGroupTaskStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateProjectGroupTaskStatusDto {
  @ApiProperty({ enum: ProjectGroupTaskStatus, example: ProjectGroupTaskStatus.IN_PROGRESS })
  @IsEnum(ProjectGroupTaskStatus)
  status!: ProjectGroupTaskStatus;
}
