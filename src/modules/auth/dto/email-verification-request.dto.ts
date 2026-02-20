import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EmailVerificationRequestDto {
  @ApiProperty({ example: 'depthead@university.edu' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Tenant domain (the institution domain returned during registration)',
    example: 'addisababauniversity',
  })
  @ApiPropertyOptional({
    description:
      'Optional. If omitted, the server will try to infer the tenant from the email (emails are globally unique).',
    example: 'addisababauniversity',
  })
  @IsOptional()
  @IsString()
  tenantDomain?: string;
}
