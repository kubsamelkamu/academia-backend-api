import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminOverrideDepartmentSubscriptionDto {
  @ApiProperty({
    description: 'Target plan name for override',
    enum: ['Free', 'Pro'],
    example: 'Pro',
  })
  @IsIn(['Free', 'Pro'])
  planName!: 'Free' | 'Pro';

  @ApiPropertyOptional({
    description: 'Optional status override',
    enum: ['active', 'past_due', 'cancelled', 'paused'],
    example: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'past_due', 'cancelled', 'paused'])
  status?: 'active' | 'past_due' | 'cancelled' | 'paused';

  @ApiPropertyOptional({
    description: 'Whether cancellation at period end is set',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for admin override (for audit)',
    example: 'Manual correction after billing support request',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
