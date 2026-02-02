import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminBackupCodesVerifyDto {
  @ApiProperty({
    description: 'A single backup code, e.g. ABCDE-FGHIJ',
    example: 'ABCDE-FGHIJ',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
