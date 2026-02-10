import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class ForgotPasswordVerifyDto {
  @ApiProperty({
    example: 'user@university.edu',
    description: 'Email address of the account',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482901',
    description: '6-digit one-time code sent to the email address',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit number' })
  otp: string;
}
