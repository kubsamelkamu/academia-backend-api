import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminTwoFactorVerifyDto {
  @ApiProperty({
    description: '6-digit code from authenticator app (TOTP)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
