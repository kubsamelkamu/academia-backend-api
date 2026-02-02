import { ApiProperty } from '@nestjs/swagger';

export class AdminTwoFactorEnableResponseDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({
    description: 'Base32 secret to be configured in authenticator app',
    example: 'JBSWY3DPEHPK3PXP',
  })
  secret: string;

  @ApiProperty({
    description: 'otpauth:// URL for QR code generation on the frontend',
    example:
      'otpauth://totp/Academic%20Platform%3Aadmin%40academia.et?secret=JBSWY3DPEHPK3PXP&issuer=Academic%20Platform',
  })
  otpauthUrl: string;
}
