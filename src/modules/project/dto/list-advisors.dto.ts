import { IsOptional, IsString } from 'class-validator';

export class ListAdvisorsDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  includeLoad?: string; // 'true' to include load info
}
