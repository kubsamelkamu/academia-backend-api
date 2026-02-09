import { IsString } from 'class-validator';

export class AssignAdvisorDto {
  @IsString()
  advisorId: string;
}