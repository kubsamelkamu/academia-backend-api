import { IsEnum } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class AdminUpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  status!: TenantStatus;
}
