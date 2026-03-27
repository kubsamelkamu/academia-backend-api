import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min, ValidateIf } from 'class-validator';
import { ProposalStatus } from '@prisma/client';

export class UpdateProposalStatusDto {
  @IsEnum(ProposalStatus)
  status: ProposalStatus;

  @ValidateIf((dto: UpdateProposalStatusDto) => dto.status === ProposalStatus.REJECTED)
  @IsString()
  @IsNotEmpty()
  feedback?: string;

  @ValidateIf((dto: UpdateProposalStatusDto) => dto.status === ProposalStatus.APPROVED)
  @ValidateIf((dto: UpdateProposalStatusDto) =>
    dto.status === ProposalStatus.APPROVED && dto.advisorId !== undefined && dto.advisorId !== null,
  )
  @IsString()
  @IsNotEmpty()
  advisorId?: string;

  @ValidateIf((dto: UpdateProposalStatusDto) => dto.status === ProposalStatus.APPROVED)
  @IsInt()
  @Min(0)
  @Max(2)
  approvedTitleIndex?: number;
}
