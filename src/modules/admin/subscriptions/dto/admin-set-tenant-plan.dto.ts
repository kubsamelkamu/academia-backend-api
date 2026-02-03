import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class AdminSetTenantPlanDto {
  @ApiProperty({
    description: 'Target plan name (local DB only).',
    enum: ['Free', 'Premium'],
    example: 'Premium',
  })
  @IsIn(['Free', 'Premium'])
  planName!: 'Free' | 'Premium';
}
