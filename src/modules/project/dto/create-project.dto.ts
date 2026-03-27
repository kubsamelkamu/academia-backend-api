import { IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  proposalId: string;

  @IsOptional()
  @IsString()
  milestoneTemplateId?: string;
}
