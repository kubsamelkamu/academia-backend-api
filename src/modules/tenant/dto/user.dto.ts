import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, IsIn, MinLength } from 'class-validator';
import { ROLES } from '../../../common/constants/roles.constants';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'student@university.edu',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({
    description:
      'User password (optional - if not provided, user will be created with pending status)',
    example: 'SecurePass123!',
  })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @ApiProperty({
    description: 'Role to assign to the user',
    example: ROLES.STUDENT,
    enum: [ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR])
  roleName: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'student@university.edu',
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}
