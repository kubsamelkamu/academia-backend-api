import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class SchedulePlanChangeDto {
  @ApiProperty({
    description: 'Target plan name to apply with period-end policy',
    enum: ['Free', 'Pro'],
    example: 'Free',
  })
  @IsIn(['Free', 'Pro'])
  planName!: 'Free' | 'Pro';

  @ApiProperty({
    description: 'Optional department override (PlatformAdmin only)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
