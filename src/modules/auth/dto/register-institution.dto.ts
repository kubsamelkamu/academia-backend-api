import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterInstitutionDto {
  @ApiProperty({
    example: 'depthead@computing.edu.et',
    description: 'The email address of the department head',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'First name of the department head',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'Smith',
    description: 'Last name of the department head',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password for the account (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'Addis Ababa University',
    description: 'Name of the university/institution',
  })
  @IsString()
  @IsNotEmpty()
  universityName: string;

  @ApiProperty({
    example: 'Computer Science',
    description: 'Name of the department',
  })
  @IsString()
  @IsNotEmpty()
  departmentName: string;

  @ApiProperty({
    example: 'CS',
    description: 'Department code (unique identifier)',
  })
  @IsString()
  @IsNotEmpty()
  departmentCode: string;

  @ApiPropertyOptional({
    example: 'Faculty of Computing and Informatics',
    description: 'Optional description of the department',
  })
  @IsOptional()
  @IsString()
  departmentDescription?: string;
}
