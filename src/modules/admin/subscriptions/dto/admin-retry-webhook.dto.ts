import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminRetryWebhookDto {
  @ApiPropertyOptional({
    description: 'Optional reason for retry (for audit log)',
    example: 'Transient DB failure fixed; retrying event',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
