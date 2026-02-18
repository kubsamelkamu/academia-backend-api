import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'Target plan name for checkout',
    enum: ['Pro'],
    example: 'Pro',
  })
  @IsIn(['Pro'])
  planName!: 'Pro';

  @ApiProperty({
    description: 'Optional department override (PlatformAdmin only)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({
    description: 'Optional return URL after checkout',
    required: false,
    example: 'http://localhost:3000/settings/billing',
  })
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
