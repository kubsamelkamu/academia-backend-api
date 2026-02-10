import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class ListProjectsDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  advisorId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;
}
