import { IsNotEmpty, IsOptional, IsString, IsObject, MaxLength } from 'class-validator';

export class AdminCreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  domain!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
