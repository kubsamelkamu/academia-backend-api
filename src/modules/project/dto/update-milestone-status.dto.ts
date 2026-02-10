import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MilestoneStatus } from '@prisma/client';

export class UpdateMilestoneStatusDto {
  @IsEnum(MilestoneStatus)
  status: MilestoneStatus;

  @IsOptional()
  @IsString()
  feedback?: string;
}
