import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'admin@academia.et',
    description: 'The email address of the user',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'The user password (min 6 characters)',
    minLength: 6,
    format: 'password',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    example: 'foc',
    description:
      'The tenant domain (e.g. "foc" for Faculty of Computing). Optional: if omitted, the server will infer the tenant from the email (emails are globally unique).',
  })
  @IsOptional()
  @IsString()
  tenantDomain?: string;
}
