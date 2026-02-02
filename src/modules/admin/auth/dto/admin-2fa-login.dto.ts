import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminTwoFactorLoginDto {
  @ApiProperty({
    description: 'Opaque token returned from /admin/auth/login when 2FA is required',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  twoFactorToken: string;

  @ApiProperty({
    description: '6-digit code from authenticator app (TOTP)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    example: 'totp',
    required: false,
    description: '2FA method. Defaults to totp. Use backup_code to use a backup code.',
  })
  @IsString()
  method?: 'totp' | 'backup_code';
}
