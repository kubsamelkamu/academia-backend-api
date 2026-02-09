import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckAdvisorAvailabilityDto {
  @IsString()
  departmentId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCapacity?: number = 1;
}