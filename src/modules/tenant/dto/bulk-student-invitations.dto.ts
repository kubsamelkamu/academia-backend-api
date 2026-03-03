import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  MaxLength,
} from 'class-validator';

export class BulkStudentInviteItemDto {
  @ApiProperty({ example: 'student1@uni.edu' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Abebe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Kebede' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;
}

export class BulkStudentInvitationsDto {
  @ApiProperty({
    description: 'List of student invites (max 50 per request)',
    example: [
      { email: 'student1@uni.edu', firstName: 'Abebe', lastName: 'Kebede' },
      { email: 'student2@uni.edu', firstName: 'Almaz', lastName: 'Tesfaye' },
    ],
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkStudentInviteItemDto)
  invites: BulkStudentInviteItemDto[];

  @ApiProperty({
    required: false,
    description: 'Optional saved message template/preset to apply to all invites in this request',
    example: 'template-id',
  })
  @IsOptional()
  @IsString()
  messageTemplateId?: string;

  @ApiProperty({
    required: false,
    description: 'Optional custom email subject to apply to all invites in this request',
    example: 'You are invited to join the department',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    required: false,
    description: 'Optional custom message to include in all invite emails (plain text)',
    example: 'Please accept and complete onboarding by Friday.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
