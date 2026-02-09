import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateTenantConfigDto {
  @ApiPropertyOptional({
    description: 'Tenant-specific configuration object',
    example: { policies: { dataRetention: 365 }, features: { analytics: true } },
  })
  @IsOptional()
  @IsObject()
  config?: any;
}