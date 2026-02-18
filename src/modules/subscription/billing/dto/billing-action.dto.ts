import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class BillingActionDto {
  @ApiPropertyOptional({
    description: 'Optional department override (PlatformAdmin only)',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
