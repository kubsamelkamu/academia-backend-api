import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { ProposalStatus } from '@prisma/client';

export class ListProposalsDto {
  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
