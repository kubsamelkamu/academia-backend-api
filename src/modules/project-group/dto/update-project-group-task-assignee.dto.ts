import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateProjectGroupTaskAssigneeDto {
  @ApiPropertyOptional({
    description: 'Set to a userId to assign, or omit/null to unassign.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
