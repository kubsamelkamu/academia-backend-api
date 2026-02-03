import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 'TENANT_NOT_FOUND' })
  code!: string;

  @ApiPropertyOptional({ description: 'Optional error details for debugging/clients' })
  details?: any;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Tenant not found' })
  message!: string;

  @ApiProperty({ type: ApiErrorDto })
  error!: ApiErrorDto;

  @ApiProperty({ example: '2026-02-03T09:10:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/admin/tenants/...' })
  path!: string;
}

export class ApiSuccessResponseDto<TData = any, TMeta = any> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Success' })
  message!: string;

  @ApiProperty()
  data!: TData;

  @ApiPropertyOptional()
  meta?: TMeta;

  @ApiProperty({ example: '2026-02-03T09:10:00.000Z' })
  timestamp!: string;
}
