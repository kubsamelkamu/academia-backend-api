import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsBoolean,
  IsUrl,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdvisorDto {
  @ApiProperty({
    description: 'User ID to be assigned as advisor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Department ID the advisor belongs to',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  departmentId: string;

  @ApiPropertyOptional({
    description: 'Maximum number of projects advisor can handle',
    example: 5,
    minimum: 1,
    maximum: 20,
    default: 5,
  })
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  loadLimit?: number;

  @ApiPropertyOptional({
    description: 'Areas of expertise',
    example: ['Software Engineering', 'Machine Learning', 'Mobile Development'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expertise?: string[];

  @ApiPropertyOptional({
    description: 'Biography/Profile of advisor',
    example: 'Senior software engineer with 10+ years of experience...',
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Office location',
    example: 'Building A, Room 101',
  })
  @IsString()
  @IsOptional()
  officeLocation?: string;

  @ApiPropertyOptional({
    description: 'Office hours',
    example: 'Monday-Friday, 2-4 PM',
  })
  @IsString()
  @IsOptional()
  officeHours?: string;

  @ApiPropertyOptional({
    description: 'Is available for new projects',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Academic rank/title',
    example: 'Associate Professor',
  })
  @IsString()
  @IsOptional()
  academicRank?: string;

  @ApiPropertyOptional({
    description: 'Qualifications',
    example: ['PhD in Computer Science', 'MSc in Software Engineering'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  qualifications?: string[];

  @ApiPropertyOptional({
    description: 'Research interests',
    example: ['AI in Education', 'Software Architecture'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  researchInterests?: string[];

  @ApiPropertyOptional({
    description: 'Profile/Website URL',
    example: 'https://university.edu/professors/johndoe',
  })
  @IsUrl()
  @IsOptional()
  profileUrl?: string;
}
