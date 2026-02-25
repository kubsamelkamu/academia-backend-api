import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminApproveTenantVerificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AdminRejectTenantVerificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
