import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProposalStatus } from '@prisma/client';

export class UpdateProposalStatusDto {
  @IsEnum(ProposalStatus)
  status: ProposalStatus;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsString()
  advisorId?: string;
}