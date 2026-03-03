import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInvitationMessageTemplateDto {
  @ApiProperty({
    description: 'Template/preset name (shown in UI)',
    example: 'Default invite note',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    required: false,
    description: 'Optional subject for the invitation email',
    example: 'You are invited to join our department',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    required: false,
    description: 'Optional plain-text message to include in the invitation email',
    example: 'Welcome! Please accept and then update your profile.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
