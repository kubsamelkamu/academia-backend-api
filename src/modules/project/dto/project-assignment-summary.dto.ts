import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ProjectAssignmentSummaryDto {
  @ApiPropertyOptional({
    description: 'Department ID (optional). If omitted, uses the authenticated user departmentId.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
