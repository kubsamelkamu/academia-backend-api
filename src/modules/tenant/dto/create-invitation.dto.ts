import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { ROLES } from '../../../common/constants/roles.constants';

export class CreateInvitationDto {
  @ApiProperty({ example: 'student@university.edu' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Abebe', description: 'Invited user first name (set by Department Head)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Kebede', description: 'Invited user last name (set by Department Head)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({
    description: 'Role to assign once invitation is accepted',
    example: ROLES.STUDENT,
    enum: [ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR])
  roleName: string;

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
    example: "You’re invited to join our department",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    required: false,
    description: 'Optional custom message to include in the invite (plain text)',
    example: 'Hi! Please join our platform and complete your profile after accepting.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
