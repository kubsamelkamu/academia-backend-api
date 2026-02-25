import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TenantVerificationStatus } from '@prisma/client';

export class AdminListTenantVerificationRequestsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(TenantVerificationStatus)
  status?: TenantVerificationStatus;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
