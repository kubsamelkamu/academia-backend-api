import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({
    example: 'user@university.edu',
    description: 'Email address of the account',
  })
  @IsEmail()
  email: string;
}
