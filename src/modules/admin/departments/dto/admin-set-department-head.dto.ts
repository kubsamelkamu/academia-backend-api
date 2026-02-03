import { IsOptional, IsUUID } from 'class-validator';

export class AdminSetDepartmentHeadDto {
  @IsOptional()
  @IsUUID()
  headOfDepartmentId?: string | null;
}
