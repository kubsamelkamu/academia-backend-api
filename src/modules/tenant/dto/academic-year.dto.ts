import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength, IsBoolean, IsObject } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({
    description: 'Academic year name',
    example: '2023-2024',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Start date of the academic year',
    example: '2023-09-01T00:00:00.000Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date of the academic year',
    example: '2024-06-30T23:59:59.999Z',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Academic year description',
    example: 'Fall 2023 to Spring 2024',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Academic year specific configuration',
    example: { semesters: 2, holidays: ['2023-12-25'] },
  })
  @IsOptional()
  @IsObject()
  config?: any;
}

export class UpdateAcademicYearDto {
  @ApiPropertyOptional({
    description: 'Academic year name',
    example: '2023-2024',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Start date of the academic year',
    example: '2023-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date of the academic year',
    example: '2024-06-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Whether this academic year is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Academic year description',
    example: 'Fall 2023 to Spring 2024',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Academic year specific configuration',
    example: { semesters: 2, holidays: ['2023-12-25'] },
  })
  @IsOptional()
  @IsObject()
  config?: any;
}