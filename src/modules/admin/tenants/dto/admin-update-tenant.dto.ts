import { IsOptional, IsString, IsObject, MaxLength } from 'class-validator';

export class AdminUpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  domain?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
