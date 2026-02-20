import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class EmailVerificationVerifyDto {
  @ApiProperty({ example: 'depthead@university.edu' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description:
      'Optional. If omitted, the server will try to infer the tenant from the email (emails are globally unique).',
    example: 'addisababauniversity',
  })
  @IsOptional()
  @IsString()
  tenantDomain?: string;

  @ApiProperty({ description: '6-digit verification code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit number' })
  otp: string;
}
