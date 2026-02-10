import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({
    example: 'user@university.edu',
    description: 'Email address of the account',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'addisababauniversity',
    description: 'Tenant domain (same value used for login)',
  })
  @IsString()
  @IsNotEmpty()
  tenantDomain: string;
}
