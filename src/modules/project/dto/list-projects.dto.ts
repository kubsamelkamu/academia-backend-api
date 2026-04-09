import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class ListProjectsDto {
  @ApiProperty({ description: 'Department ID', format: 'uuid' })
  @IsUUID()
  departmentId: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Filter by advisor user ID', format: 'uuid' })
  @IsOptional()
  @IsString()
  advisorId?: string;

  @ApiPropertyOptional({ description: 'Filter by student user ID', format: 'uuid' })
  @IsOptional()
  @IsString()
  studentId?: string;
}
