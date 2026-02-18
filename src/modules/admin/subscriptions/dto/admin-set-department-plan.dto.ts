import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class AdminSetDepartmentPlanDto {
  @ApiProperty({
    description: 'Target plan name (local DB only).',
    enum: ['Free', 'Pro'],
    example: 'Pro',
  })
  @IsIn(['Free', 'Pro'])
  planName!: 'Free' | 'Pro';
}
