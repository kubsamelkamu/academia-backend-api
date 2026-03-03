import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { ROLES } from '../../../common/constants/roles.constants';

export class PreviewInvitationEmailDto {
  @ApiProperty({
    description: 'Role to preview the invitation email for',
    example: ROLES.STUDENT,
    enum: [ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR],
  })
  @IsString()
  @IsIn([ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR])
  roleName: string;

  @ApiProperty({
    required: false,
    description: 'Optional invitee first name to preview personalized greeting',
    example: 'Abebe',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({
    required: false,
    description: 'Optional invitee last name to preview personalized greeting',
    example: 'Kebede',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({
    required: false,
    description: 'Optional saved message template/preset to apply',
    example: 'template-id',
  })
  @IsOptional()
  @IsString()
  messageTemplateId?: string;

  @ApiProperty({
    required: false,
    description: 'Optional custom email subject (safe text only)',
    example: 'You are invited to join our department',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    required: false,
    description: 'Optional custom message to include in the invite (plain text)',
    example: 'Please accept the invitation and complete onboarding.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
