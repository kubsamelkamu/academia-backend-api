import { IsInt, Min, Max } from 'class-validator';

export class SetAdvisorLoadLimitDto {
  @IsInt()
  @Min(1)
  @Max(20) // Reasonable upper limit
  loadLimit: number;
}
