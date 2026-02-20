import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class EmailVerificationRequestDto {
  @ApiProperty({ example: 'depthead@university.edu' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Tenant domain (the institution domain returned during registration)',
    example: 'addisababauniversity',
  })
  @IsString()
  @IsNotEmpty()
  tenantDomain: string;
}
