import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ForgotPasswordResetDto {
  @ApiProperty({
    description: 'Short-lived token obtained from /auth/forgot-password/verify',
  })
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  @ApiProperty({
    description: 'New password',
    minLength: 8,
    example: 'StrongPass@123',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
